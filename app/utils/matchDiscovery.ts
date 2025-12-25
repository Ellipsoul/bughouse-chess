/**
 * Match Discovery Service
 *
 * Discovers subsequent bughouse games with the same four players and team pairings.
 * Uses rate-limited API requests to avoid overwhelming Chess.com's servers.
 */

import type { ChessGame } from "../actions";
import { fetchChessGame, fetchPlayerMonthlyGames } from "../actions";
import type {
  DiscoveryDirection,
  MatchDiscoveryCallbacks,
  MatchDiscoveryParams,
  MatchGame,
  PublicGameRecord,
  TeamComposition,
} from "../types/match";

/**
 * Number of consecutive non-matching games before stopping discovery.
 * If we find 3 games in a row that don't match, the match is likely over.
 */
const CONSECUTIVE_NON_MATCH_THRESHOLD = 3;

/**
 * Delay between API requests in milliseconds.
 * Set to 0.5 seconds  to respect Chess.com's rate limits.
 */
const API_REQUEST_DELAY_MS = 500;

/**
 * Extracts the game ID from a Chess.com game URL.
 *
 * @param url - Full Chess.com game URL (e.g., "https://www.chess.com/game/live/159028650535")
 * @returns The game ID as a string, or null if extraction fails.
 *
 * @example
 * extractGameIdFromUrl("https://www.chess.com/game/live/159028650535")
 * // Returns: "159028650535"
 */
export function extractGameIdFromUrl(url: string): string | null {
  if (!url) return null;

  try {
    // The game ID is the last path segment
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split("/").filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];

    // Validate it looks like a game ID (12 digits)
    if (lastSegment && /^\d{12}$/.test(lastSegment)) {
      return lastSegment;
    }

    return null;
  } catch {
    // If URL parsing fails, try simple string extraction
    const match = url.match(/\/(\d{12})(?:\/|$)/);
    return match ? match[1] : null;
  }
}

/**
 * Extracts the team composition from a pair of bughouse games.
 * Returns the normalized usernames for both teams.
 *
 * In bughouse, partners are:
 * - Board A white + Board B black = Team 1
 * - Board A black + Board B white = Team 2
 *
 * @param originalGame - Board A game data.
 * @param partnerGame - Board B game data.
 * @returns TeamComposition with normalized (lowercase, sorted) team arrays.
 */
export function extractTeamComposition(
  originalGame: ChessGame,
  partnerGame: ChessGame | null,
): TeamComposition {
  // Get players from each game
  const boardAWhite = getWhitePlayer(originalGame)?.toLowerCase() ?? "";
  const boardABlack = getBlackPlayer(originalGame)?.toLowerCase() ?? "";
  const boardBWhite = partnerGame ? getWhitePlayer(partnerGame)?.toLowerCase() ?? "" : "";
  const boardBBlack = partnerGame ? getBlackPlayer(partnerGame)?.toLowerCase() ?? "" : "";

  // Team 1: Board A white + Board B black (partners)
  // Team 2: Board A black + Board B white (partners)
  const team1: [string, string] = [boardAWhite, boardBBlack].sort() as [string, string];
  const team2: [string, string] = [boardABlack, boardBWhite].sort() as [string, string];

  return { team1, team2 };
}

/**
 * Checks if two team compositions are identical.
 * Both teams must have the same players in the same pairings.
 *
 * @param comp1 - First team composition.
 * @param comp2 - Second team composition.
 * @returns True if the compositions are identical.
 */
export function areTeamsIdentical(
  comp1: TeamComposition,
  comp2: TeamComposition,
): boolean {
  // Teams are already sorted, so we can do direct comparison
  // Check if team1 matches team1 and team2 matches team2
  const directMatch =
    comp1.team1[0] === comp2.team1[0] &&
    comp1.team1[1] === comp2.team1[1] &&
    comp1.team2[0] === comp2.team2[0] &&
    comp1.team2[1] === comp2.team2[1];

  // Also check if teams are swapped (team1 <-> team2)
  // This can happen if the "board" designation changes between games
  const swappedMatch =
    comp1.team1[0] === comp2.team2[0] &&
    comp1.team1[1] === comp2.team2[1] &&
    comp1.team2[0] === comp2.team1[0] &&
    comp1.team2[1] === comp2.team1[1];

  return directMatch || swappedMatch;
}

/**
 * Gets the white player's username from a game.
 */
function getWhitePlayer(game: ChessGame): string | null {
  const top = game.players.top;
  const bottom = game.players.bottom;

  if (top.color?.toLowerCase() === "white") return top.username;
  if (bottom.color?.toLowerCase() === "white") return bottom.username;

  // Fallback: assume top is white
  return top.username;
}

/**
 * Gets the black player's username from a game.
 */
function getBlackPlayer(game: ChessGame): string | null {
  const top = game.players.top;
  const bottom = game.players.bottom;

  if (top.color?.toLowerCase() === "black") return top.username;
  if (bottom.color?.toLowerCase() === "black") return bottom.username;

  // Fallback: assume bottom is black
  return bottom.username;
}

/**
 * Gets all four player usernames from a bughouse game pair.
 * Returns an array of lowercase usernames.
 */
export function getAllPlayerUsernames(
  originalGame: ChessGame,
  partnerGame: ChessGame | null,
): string[] {
  const players = new Set<string>();

  // Add board A players
  players.add(originalGame.players.top.username.toLowerCase());
  players.add(originalGame.players.bottom.username.toLowerCase());

  // Add board B players if available
  if (partnerGame) {
    players.add(partnerGame.players.top.username.toLowerCase());
    players.add(partnerGame.players.bottom.username.toLowerCase());
  }

  return Array.from(players);
}

/**
 * Parses a date string in "YYYY.MM.DD" format (from PGN headers) into year/month.
 *
 * @param dateStr - Date string like "2025.12.17"
 * @returns Object with year and month, or null if parsing fails.
 */
export function parsePgnDate(dateStr: string): { year: number; month: number } | null {
  if (!dateStr) return null;

  const parts = dateStr.split(".");
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);

  if (isNaN(year) || isNaN(month) || year < 2000 || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

/**
 * Controller for cancelling ongoing discovery operations.
 */
export class DiscoveryCancellation {
  private cancelled = false;

  cancel(): void {
    this.cancelled = true;
  }

  isCancelled(): boolean {
    return this.cancelled;
  }
}

/**
 * Delays execution for a specified number of milliseconds.
 * Supports cancellation via AbortController.
 */
async function delay(ms: number, cancellation?: DiscoveryCancellation): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);

    // Check for cancellation
    if (cancellation?.isCancelled()) {
      clearTimeout(timeout);
      reject(new Error("Discovery cancelled"));
    }
  });
}

/**
 * Internal search context shared between forward and backward searches.
 */
interface SearchContext {
  referenceTeams: TeamComposition;
  archivePlayer: string;
  callbacks: MatchDiscoveryCallbacks;
  cancellation?: DiscoveryCancellation;
  gamesChecked: number;
  gamesFound: number;
}

/**
 * Searches for match games in one direction (before or after the initial game).
 *
 * @param context - Shared search context with reference teams and callbacks.
 * @param initialEndTime - Unix timestamp of the initial game.
 * @param monthsToCheck - List of year/month pairs to search.
 * @param direction - "before" or "after" the initial game.
 * @returns Number of games found in this direction.
 */
async function searchInDirection(
  context: SearchContext,
  initialEndTime: number,
  monthsToCheck: Array<{ year: number; month: number }>,
  direction: DiscoveryDirection,
): Promise<number> {
  let consecutiveNonMatches = 0;
  let directionGamesFound = 0;

  for (const { year, month } of monthsToCheck) {
    if (context.cancellation?.isCancelled()) {
      return directionGamesFound;
    }

    // Fetch the archive
    let archive: PublicGameRecord[];
    try {
      archive = await fetchPlayerMonthlyGames(context.archivePlayer, year, month);
    } catch (error) {
      // If this is a rate limit, propagate the error
      if (error instanceof Error && error.message.includes("Rate limited")) {
        context.callbacks.onError(error);
        return directionGamesFound;
      }
      // Otherwise try the next month
      console.warn(`Failed to fetch archive for ${year}/${month}:`, error);
      continue;
    }

    // Filter for bughouse games in the correct direction
    let candidates: PublicGameRecord[];
    if (direction === "before") {
      // Games before the initial game, sorted newest first (to go backward in time)
      candidates = archive
        .filter((game) => game.rules === "bughouse")
        .filter((game) => game.end_time < initialEndTime)
        .sort((a, b) => b.end_time - a.end_time);
    } else {
      // Games after the initial game, sorted oldest first (to go forward in time)
      candidates = archive
        .filter((game) => game.rules === "bughouse")
        .filter((game) => game.end_time > initialEndTime)
        .sort((a, b) => a.end_time - b.end_time);
    }

    if (candidates.length === 0) {
      continue;
    }

    // Process each candidate with rate limiting
    for (const candidate of candidates) {
      if (context.cancellation?.isCancelled()) {
        return directionGamesFound;
      }

      // Stop if we've hit too many consecutive non-matches
      if (consecutiveNonMatches >= CONSECUTIVE_NON_MATCH_THRESHOLD) {
        return directionGamesFound;
      }

      // Rate limit: wait before the next request
      if (context.gamesChecked > 0) {
        await delay(API_REQUEST_DELAY_MS, context.cancellation);
      }

      context.gamesChecked++;
      context.callbacks.onProgress?.(context.gamesChecked, context.gamesFound);

      // Extract game ID from URL
      const candidateGameId = extractGameIdFromUrl(candidate.url);
      if (!candidateGameId) {
        consecutiveNonMatches++;
        continue;
      }

      try {
        // Fetch the full game data
        const candidateGame = await fetchChessGame(candidateGameId);
        if (!candidateGame) {
          consecutiveNonMatches++;
          continue;
        }

        // Get the partner game ID
        const candidatePartnerIdNum = candidateGame.game.partnerGameId;
        if (!candidatePartnerIdNum) {
          consecutiveNonMatches++;
          continue;
        }

        const candidatePartnerId = candidatePartnerIdNum.toString();

        // Rate limit before fetching partner
        await delay(API_REQUEST_DELAY_MS, context.cancellation);

        // Fetch the partner game
        const candidatePartner = await fetchChessGame(candidatePartnerId);
        if (!candidatePartner) {
          consecutiveNonMatches++;
          continue;
        }

        // Check if the teams match
        const candidateTeams = extractTeamComposition(candidateGame, candidatePartner);
        if (!areTeamsIdentical(context.referenceTeams, candidateTeams)) {
          consecutiveNonMatches++;
          continue;
        }

        // Match found!
        consecutiveNonMatches = 0;
        directionGamesFound++;
        context.gamesFound++;

        const matchGame: MatchGame = {
          gameId: candidateGameId,
          partnerGameId: candidatePartnerId,
          original: candidateGame,
          partner: candidatePartner,
          endTime: candidateGame.game.endTime ?? candidate.end_time,
        };

        context.callbacks.onGameFound(matchGame, direction);
        context.callbacks.onProgress?.(context.gamesChecked, context.gamesFound);
      } catch (error) {
        // Log but continue checking other games
        console.warn(`Failed to check candidate game ${candidateGameId}:`, error);
        consecutiveNonMatches++;
      }
    }
  }

  return directionGamesFound;
}

/**
 * Discovers match games by scanning the player's monthly game archives
 * in both directions (before and after the initially loaded game).
 *
 * The discovery process:
 * 1. Searches backward for games before the initial game
 * 2. Searches forward for games after the initial game
 * 3. For each candidate, fetches full game data via the callback API
 * 4. Validates that all 4 players and team pairings match
 * 5. Stops in each direction when 3 consecutive non-matching games are found
 *
 * @param params - The initial game data (original + partner).
 * @param callbacks - Event callbacks for progress, completion, and errors.
 * @param cancellation - Optional cancellation controller.
 */
export async function discoverMatchGames(
  params: MatchDiscoveryParams,
  callbacks: MatchDiscoveryCallbacks,
  cancellation?: DiscoveryCancellation,
): Promise<void> {
  const { originalGame, partnerGame } = params;

  // Get the reference team composition
  const referenceTeams = extractTeamComposition(originalGame, partnerGame);

  // Get the end time of the initial game (Unix timestamp)
  const initialEndTime = originalGame.game.endTime ?? 0;
  if (!initialEndTime) {
    callbacks.onError(new Error("Cannot determine game end time"));
    return;
  }

  // Parse the date to get year/month for archive lookup
  const dateInfo = parsePgnDate(originalGame.game.pgnHeaders.Date);
  if (!dateInfo) {
    callbacks.onError(new Error("Cannot parse game date"));
    return;
  }

  // Pick one player to use for archive lookup
  const players = getAllPlayerUsernames(originalGame, partnerGame);
  if (players.length === 0) {
    callbacks.onError(new Error("No player usernames found"));
    return;
  }

  // Use the first player's archive
  const archivePlayer = players[0];

  const currentYear = dateInfo.year;
  const currentMonth = dateInfo.month;
  const dayOfMonth = parseInt(originalGame.game.pgnHeaders.Date.split(".")[2] ?? "15", 10);

  // Create search context
  const context: SearchContext = {
    referenceTeams,
    archivePlayer,
    callbacks,
    cancellation,
    gamesChecked: 0,
    gamesFound: 0,
  };

  try {
    // === PHASE 1: Search backward (games before the initial game) ===
    const backwardMonths: Array<{ year: number; month: number }> = [
      { year: currentYear, month: currentMonth },
    ];

    // Add previous month if we're in the first half of the month
    if (dayOfMonth <= 15) {
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      backwardMonths.push({ year: prevYear, month: prevMonth });
    }

    const gamesFoundBefore = await searchInDirection(
      context,
      initialEndTime,
      backwardMonths,
      "before",
    );

    if (cancellation?.isCancelled()) {
      return;
    }

    // === PHASE 2: Search forward (games after the initial game) ===
    const forwardMonths: Array<{ year: number; month: number }> = [
      { year: currentYear, month: currentMonth },
    ];

    // Add next month if we're in the latter half of the month
    if (dayOfMonth >= 15) {
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
      forwardMonths.push({ year: nextYear, month: nextMonth });
    }

    await searchInDirection(
      context,
      initialEndTime,
      forwardMonths,
      "after",
    );

    // Discovery complete
    // Total games = games found + 1 (the initial game)
    // Initial game index = number of games found before it
    const totalGames = context.gamesFound + 1;
    const initialGameIndex = gamesFoundBefore;
    callbacks.onComplete(totalGames, initialGameIndex);
  } catch (error) {
    if (error instanceof Error && error.message === "Discovery cancelled") {
      // Silently handle cancellation
      return;
    }
    callbacks.onError(error instanceof Error ? error : new Error("Discovery failed"));
  }
}

/**
 * Creates a MatchGame from the initially loaded game data.
 *
 * @param originalGame - Board A game data.
 * @param partnerGame - Board B game data (may be null).
 * @param partnerId - Partner game ID (may be null).
 * @returns A MatchGame representing the initial game.
 */
export function createMatchGameFromLoaded(
  originalGame: ChessGame,
  partnerGame: ChessGame | null,
  partnerId: string | null,
): MatchGame {
  return {
    gameId: originalGame.game.id.toString(),
    partnerGameId: partnerId ?? "",
    original: originalGame,
    partner: partnerGame!,
    endTime: originalGame.game.endTime ?? 0,
  };
}

