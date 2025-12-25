import type { ChessGame } from "../actions";

/**
 * Represents the team composition for a bughouse match.
 * Each team consists of two players who are partners across the two boards.
 *
 * In bughouse:
 * - Board A white + Board B black = Team 1
 * - Board A black + Board B white = Team 2
 *
 * Usernames are normalized to lowercase for comparison.
 */
export interface TeamComposition {
  /**
   * Sorted array of two lowercase usernames representing Team 1.
   * (Board A white player + Board B black player)
   */
  team1: [string, string];
  /**
   * Sorted array of two lowercase usernames representing Team 2.
   * (Board A black player + Board B white player)
   */
  team2: [string, string];
}

/**
 * Discovery mode for match finding.
 * - "fullMatch": Find games with all 4 identical players (original behavior)
 * - "partnerPair": Find games where two specific players are partnered together
 */
export type DiscoveryMode = "fullMatch" | "partnerPair";

/**
 * Represents a pair of partners for partner pair discovery.
 * Contains both lowercase usernames and display names.
 */
export interface PartnerPair {
  /**
   * Lowercase usernames for comparison.
   */
  usernames: [string, string];
  /**
   * Original case display names for UI.
   */
  displayNames: [string, string];
}

/**
 * A single game within a discovered match, containing both boards' data.
 */
export interface MatchGame {
  /**
   * The primary game ID (Board A).
   */
  gameId: string;
  /**
   * The partner game ID (Board B).
   */
  partnerGameId: string;
  /**
   * Full game data for Board A.
   */
  original: ChessGame;
  /**
   * Full game data for Board B.
   */
  partner: ChessGame;
  /**
   * Unix timestamp when the game ended.
   * Used for chronological ordering of games within the match.
   */
  endTime: number;
}

/**
 * Status of the match discovery process.
 */
export type MatchDiscoveryStatus =
  | "idle"
  | "discovering"
  | "complete"
  | "error";

/**
 * State for the match replay system.
 */
export interface MatchState {
  /**
   * Array of discovered match games in chronological order.
   * With bidirectional discovery, the initially loaded game may be at any index.
   */
  games: MatchGame[];
  /**
   * Index of the currently displayed game in the games array.
   */
  currentIndex: number;
  /**
   * Current status of the match discovery process.
   */
  discoveryStatus: MatchDiscoveryStatus;
  /**
   * Number of match games discovered so far.
   * Updated incrementally during discovery.
   */
  discoveredCount: number;
  /**
   * Error message if discovery failed.
   */
  errorMessage?: string;
}

/**
 * A game record from the Chess.com public API monthly archives endpoint.
 * This is a subset of the full response - only the fields we need.
 *
 * @see https://api.chess.com/pub/player/{username}/games/{year}/{month}
 */
export interface PublicGameRecord {
  /**
   * URL to the game on chess.com.
   * Contains the game ID as the last path segment.
   * Example: "https://www.chess.com/game/live/159028650535"
   */
  url: string;
  /**
   * Unix timestamp when the game ended.
   */
  end_time: number;
  /**
   * Game variant/rules (e.g., "chess", "bughouse", "crazyhouse").
   */
  rules: string;
  /**
   * Time control string (e.g., "180", "300+5").
   */
  time_control: string;
  /**
   * Whether the game was rated.
   */
  rated: boolean;
  /**
   * White player information.
   */
  white: {
    username: string;
    rating: number;
    result: string;
  };
  /**
   * Black player information.
   */
  black: {
    username: string;
    rating: number;
    result: string;
  };
}

/**
 * Response from the Chess.com public API monthly archives endpoint.
 */
export interface PublicGamesResponse {
  games: PublicGameRecord[];
}

/**
 * Parameters for initiating match discovery.
 */
export interface MatchDiscoveryParams {
  /**
   * The initially loaded game (Board A).
   */
  originalGame: ChessGame;
  /**
   * The partner game (Board B), if found.
   */
  partnerGame: ChessGame | null;
  /**
   * The ID of the partner game.
   */
  partnerId: string | null;
  /**
   * Discovery mode: full match (4 players) or partner pair (2 players).
   * Defaults to "fullMatch" if not specified.
   */
  mode?: DiscoveryMode;
  /**
   * The selected partner pair for "partnerPair" mode.
   * Required when mode is "partnerPair".
   */
  selectedPair?: PartnerPair;
}

/**
 * Direction of match game discovery relative to the initially loaded game.
 */
export type DiscoveryDirection = "before" | "after";

/**
 * Callbacks for match discovery events.
 */
export interface MatchDiscoveryCallbacks {
  /**
   * Called when a new match game is discovered.
   * @param game - The discovered match game.
   * @param direction - Whether this game is before or after the initial game.
   */
  onGameFound: (game: MatchGame, direction: DiscoveryDirection) => void;
  /**
   * Called when discovery completes successfully.
   * @param totalGames - Total number of games in the match (including initial).
   * @param initialGameIndex - Index of the initially loaded game in the match.
   */
  onComplete: (totalGames: number, initialGameIndex: number) => void;
  /**
   * Called when discovery encounters an error.
   */
  onError: (error: Error) => void;
  /**
   * Called to update discovery progress.
   */
  onProgress?: (checked: number, found: number) => void;
}

/**
 * Creates an initial match state with the first game.
 *
 * @param initialGame - The first game to include in the match.
 * @returns A new MatchState with the initial game.
 */
export function createInitialMatchState(initialGame: MatchGame): MatchState {
  return {
    games: [initialGame],
    currentIndex: 0,
    discoveryStatus: "idle",
    discoveredCount: 1,
  };
}

/**
 * Creates an empty match state (no games loaded).
 *
 * @returns An empty MatchState.
 */
export function createEmptyMatchState(): MatchState {
  return {
    games: [],
    currentIndex: 0,
    discoveryStatus: "idle",
    discoveredCount: 0,
  };
}

/**
 * Extracts the two partner pairs from a bughouse game.
 * Returns both pairs with their display names and normalized usernames.
 *
 * @param originalGame - The primary board game data.
 * @param partnerGame - The partner board game data.
 * @returns Array of two PartnerPair objects, or null if partner game is missing.
 */
export function extractPartnerPairs(
  originalGame: ChessGame,
  partnerGame: ChessGame | null,
): [PartnerPair, PartnerPair] | null {
  if (!partnerGame) return null;

  const boardAWhite = originalGame.game.pgnHeaders.White;
  const boardABlack = originalGame.game.pgnHeaders.Black;
  const boardBWhite = partnerGame.game.pgnHeaders.White;
  const boardBBlack = partnerGame.game.pgnHeaders.Black;

  // Team 1: Board A white + Board B black (partners)
  const pair1: PartnerPair = {
    usernames: [boardAWhite.toLowerCase(), boardBBlack.toLowerCase()].sort() as [string, string],
    displayNames: [boardAWhite, boardBBlack],
  };

  // Team 2: Board A black + Board B white (partners)
  const pair2: PartnerPair = {
    usernames: [boardABlack.toLowerCase(), boardBWhite.toLowerCase()].sort() as [string, string],
    displayNames: [boardABlack, boardBWhite],
  };

  return [pair1, pair2];
}
