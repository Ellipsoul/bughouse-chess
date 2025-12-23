/**
 * Match Discovery Service
 *
 * Discovers subsequent bughouse games with the same four players and team pairings.
 * Uses rate-limited API requests to avoid overwhelming Chess.com's servers.
 */

import type { ChessGame } from "../actions";
import { fetchChessGame, fetchPlayerMonthlyGames } from "../actions";
import type {
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
 * Discovers match games by scanning the player's monthly game archives.
 *
 * The discovery process:
 * 1. Fetches the monthly game archive for one of the players
 * 2. Filters for bughouse games after the loaded game's timestamp
 * 3. For each candidate, fetches full game data via the callback API
 * 4. Validates that all 4 players and team pairings match
 * 5. Stops when 3 consecutive non-matching games are found
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

  let gamesFound = 0;
  let consecutiveNonMatches = 0;
  let gamesChecked = 0;

  try {
    // Fetch games for the current month
    const currentYear = dateInfo.year;
    const currentMonth = dateInfo.month;
    let archiveExhausted = false;

    // We may need to check the next month too if the game was near month end
    const monthsToCheck = [
      { year: currentYear, month: currentMonth },
    ];

    // Add next month if we're in the latter half of the month
    const dayOfMonth = parseInt(originalGame.game.pgnHeaders.Date.split(".")[2] ?? "1", 10);
    if (dayOfMonth >= 15) {
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
      monthsToCheck.push({ year: nextYear, month: nextMonth });
    }

    for (const { year, month } of monthsToCheck) {
      if (cancellation?.isCancelled()) {
        return;
      }

      if (archiveExhausted) {
        break;
      }

      // Fetch the archive
      let archive: PublicGameRecord[];
      try {
        archive = await fetchPlayerMonthlyGames(archivePlayer, year, month);
      } catch (error) {
        // If this is a rate limit, propagate the error
        if (error instanceof Error && error.message.includes("Rate limited")) {
          callbacks.onError(error);
          return;
        }
        // Otherwise try the next month
        console.warn(`Failed to fetch archive for ${year}/${month}:`, error);
        continue;
      }

      // Filter for bughouse games after our initial game
      const candidates = archive
        .filter((game) => game.rules === "bughouse")
        .filter((game) => game.end_time > initialEndTime)
        .sort((a, b) => a.end_time - b.end_time);

      if (candidates.length === 0) {
        archiveExhausted = true;
        continue;
      }

      // Process each candidate with rate limiting
      for (const candidate of candidates) {
        if (cancellation?.isCancelled()) {
          return;
        }

        // Stop if we've hit too many consecutive non-matches
        if (consecutiveNonMatches >= CONSECUTIVE_NON_MATCH_THRESHOLD) {
          archiveExhausted = true;
          break;
        }

        // Rate limit: wait before the next request
        if (gamesChecked > 0) {
          await delay(API_REQUEST_DELAY_MS, cancellation);
        }

        gamesChecked++;
        callbacks.onProgress?.(gamesChecked, gamesFound);

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
          await delay(API_REQUEST_DELAY_MS, cancellation);

          // Fetch the partner game
          const candidatePartner = await fetchChessGame(candidatePartnerId);
          if (!candidatePartner) {
            consecutiveNonMatches++;
            continue;
          }

          // Check if the teams match
          const candidateTeams = extractTeamComposition(candidateGame, candidatePartner);
          if (!areTeamsIdentical(referenceTeams, candidateTeams)) {
            consecutiveNonMatches++;
            continue;
          }

          // Match found!
          consecutiveNonMatches = 0;
          gamesFound++;

          const matchGame: MatchGame = {
            gameId: candidateGameId,
            partnerGameId: candidatePartnerId,
            original: candidateGame,
            partner: candidatePartner,
            endTime: candidateGame.game.endTime ?? candidate.end_time,
          };

          callbacks.onGameFound(matchGame);
          callbacks.onProgress?.(gamesChecked, gamesFound);
        } catch (error) {
          // Log but continue checking other games
          console.warn(`Failed to check candidate game ${candidateGameId}:`, error);
          consecutiveNonMatches++;
        }
      }
    }

    // Discovery complete
    // Include the initial game in the count (gamesFound + 1)
    callbacks.onComplete(gamesFound + 1);
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

