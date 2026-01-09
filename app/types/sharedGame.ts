import type { Timestamp } from "firebase/firestore";
import type { ChessGame } from "../actions";
import type { MatchGame } from "./match";

/* -------------------------------------------------------------------------- */
/* Shared Game Types                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The type of content being shared.
 * - "game": A single bughouse game (one pair of boards)
 * - "match": A full match with all 4 players across multiple games
 * - "partnerGames": Games between two specific partners vs random opponents
 */
export type SharedContentType = "game" | "match" | "partnerGames";

/**
 * Player information for display in shared game cards.
 */
export interface SharedGamePlayer {
  username: string;
  chessTitle?: string;
}

/**
 * Team composition for shared games/matches.
 * Each team consists of two partners (Board A White + Board B Black, or vice versa).
 */
export interface SharedGameTeam {
  player1: SharedGamePlayer;
  player2: SharedGamePlayer;
}

/**
 * Metadata about the shared game/match for display purposes.
 * This is denormalized from the game data for efficient querying and display.
 */
export interface SharedGameMetadata {
  /**
   * Number of games in the shared content.
   * For single games, this is 1.
   * For matches/partner games, this is the total game count.
   */
  gameCount: number;

  /**
   * Match/series result as "team1Wins - team2Wins" (e.g., "8 - 9").
   * For single games, this represents the game outcome (e.g., "1 - 0").
   */
  result: string;

  /**
   * Team 1 players (Board A White + Board B Black partners).
   */
  team1: SharedGameTeam;

  /**
   * Team 2 players (Board A Black + Board B White partners).
   */
  team2: SharedGameTeam;
}

/**
 * Game data stored for a single game.
 * Contains both boards' pristine game data.
 */
export interface SingleGameData {
  /**
   * Board A game data.
   */
  original: ChessGame;

  /**
   * Board B game data (partner board).
   */
  partner: ChessGame | null;

  /**
   * Partner game ID for reference.
   */
  partnerId: string | null;
}

/**
 * Game data stored for a match (multiple games).
 * Each entry contains both boards' data for one game in the series.
 */
export interface MatchGameData {
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
   */
  endTime: number;
}

/**
 * The complete game data payload stored in Firestore.
 * Discriminated union based on content type.
 */
export type SharedGameData =
  | {
      type: "game";
      game: SingleGameData;
    }
  | {
      type: "match" | "partnerGames";
      games: MatchGameData[];
    };

/**
 * Document structure for the `sharedGames/{sharedId}` collection.
 * This is the main collection that stores all shared games publicly.
 */
export interface SharedGameDocument {
  /**
   * Unique identifier for this shared game (UUID).
   * Same as the document ID.
   */
  id: string;

  /**
   * Type of content being shared.
   */
  type: SharedContentType;

  /**
   * Firebase Auth UID of the user who shared this content.
   */
  sharerUserId: string;

  /**
   * Username of the sharer (denormalized for display).
   */
  sharerUsername: string;

  /**
   * Optional description provided by the sharer (max 100 characters).
   */
  description: string;

  /**
   * Timestamp when this game/match was shared.
   */
  sharedAt: Timestamp;

  /**
   * Date when the game/match was originally played.
   * Extracted from the game data for sorting/display.
   */
  gameDate: Timestamp;

  /**
   * The actual game data (pristine, as loaded from Chess.com).
   */
  gameData: SharedGameData;

  /**
   * Denormalized metadata for efficient card display.
   */
  metadata: SharedGameMetadata;
}

/**
 * Document structure for the `users/{userId}/sharedGames/{sharedId}` subcollection.
 * This allows users to efficiently list and manage their own shared games.
 */
export interface UserSharedGameReference {
  /**
   * Reference to the shared game in the main collection.
   * Same as the document ID.
   */
  sharedId: string;

  /**
   * Timestamp when this game was shared.
   * Duplicated here for efficient sorting of user's shared games.
   */
  sharedAt: Timestamp;
}

/* -------------------------------------------------------------------------- */
/* Client-Side Types (for UI)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Shared game data as used in the client UI.
 * Timestamps are converted to JavaScript Date objects.
 */
export interface SharedGame {
  id: string;
  type: SharedContentType;
  sharerUserId: string;
  sharerUsername: string;
  description: string;
  sharedAt: Date;
  gameDate: Date;
  gameData: SharedGameData;
  metadata: SharedGameMetadata;
}

/**
 * Options for fetching shared games with pagination.
 */
export interface GetSharedGamesOptions {
  /**
   * Number of games to fetch per page.
   * @default 12
   */
  pageSize?: number;

  /**
   * Cursor for pagination (sharedAt timestamp of the last item from previous page).
   */
  startAfter?: Date;
}

/**
 * Result of a paginated shared games query.
 */
export interface SharedGamesPage {
  /**
   * The shared games for this page.
   */
  games: SharedGame[];

  /**
   * Whether there are more games after this page.
   */
  hasMore: boolean;

  /**
   * Cursor for fetching the next page.
   * Pass this as `startAfter` to get the next page.
   */
  nextCursor: Date | null;
}

/**
 * Result of sharing a game/match.
 */
export type ShareResult =
  | { success: true; sharedId: string }
  | { success: false; error: string };

/**
 * Result of deleting a shared game.
 */
export type DeleteSharedGameResult =
  | { success: true }
  | { success: false; error: string };

/* -------------------------------------------------------------------------- */
/* Helper Functions                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Converts a Firestore SharedGameDocument to a client-side SharedGame.
 *
 * @param doc - The Firestore document data
 * @returns The client-side SharedGame object
 */
export function toSharedGame(doc: SharedGameDocument): SharedGame {
  return {
    id: doc.id,
    type: doc.type,
    sharerUserId: doc.sharerUserId,
    sharerUsername: doc.sharerUsername,
    description: doc.description,
    sharedAt: doc.sharedAt.toDate(),
    gameDate: doc.gameDate.toDate(),
    gameData: doc.gameData,
    metadata: doc.metadata,
  };
}

/**
 * Converts MatchGame[] (from match discovery) to MatchGameData[] for storage.
 *
 * @param matchGames - Array of discovered match games
 * @returns Array of match game data suitable for Firestore storage
 */
export function toMatchGameData(matchGames: MatchGame[]): MatchGameData[] {
  return matchGames.map((game) => ({
    gameId: game.gameId,
    partnerGameId: game.partnerGameId,
    original: game.original,
    partner: game.partner,
    endTime: game.endTime,
  }));
}

/**
 * Converts stored MatchGameData[] back to MatchGame[] for the viewer.
 *
 * @param data - Array of stored match game data
 * @returns Array of MatchGame objects for use in the viewer
 */
export function fromMatchGameData(data: MatchGameData[]): MatchGame[] {
  return data.map((game) => ({
    gameId: game.gameId,
    partnerGameId: game.partnerGameId,
    original: game.original,
    partner: game.partner,
    endTime: game.endTime,
  }));
}

/**
 * Maximum character length for shared game descriptions.
 */
export const SHARED_GAME_DESCRIPTION_MAX_LENGTH = 100;

/**
 * Default page size for shared games pagination.
 */
export const SHARED_GAMES_DEFAULT_PAGE_SIZE = 12;
