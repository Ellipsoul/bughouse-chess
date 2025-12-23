"use server";

import type { PublicGameRecord, PublicGamesResponse } from "./types/match";

/**
 * Shape of the chess.com live game payload used by the viewer.
 */
export interface ChessGame {
  game: {
    id: number;
    uuid: string;
    moveList: string;
    type: string;
    typeName: string;
    partnerGameId?: number;
    plyCount: number;
    isFinished: boolean;
    isRated: boolean;
    colorOfWinner?: string;
    gameEndReason?: string;
    resultMessage?: string;
    endTime?: number;
    turnColor: string;
    ratingChangeWhite?: number;
    ratingChangeBlack?: number;
    pgnHeaders: {
      Event: string;
      Site: string;
      Date: string;
      White: string;
      Black: string;
      Result: string;
      ECO?: string;
      WhiteElo: number;
      BlackElo: number;
      TimeControl: string;
      EndTime?: string;
      Termination?: string;
      SetUp?: string;
      FEN?: string;
      Variant?: string;
    };
    moveTimestamps?: string;
    baseTime1: number;
    timeIncrement1: number;
  };
  players: {
    top: {
      id: number;
      username: string;
      rating: number;
      color: string;
      avatarUrl?: string;
      countryName?: string;
      chessTitle?: string;
      membershipCode?: string;
      isOnline?: boolean;
      flair?: {
        id: string;
        images: {
          png: string;
          svg: string;
          lottie: string;
        };
      };
    };
    bottom: {
      id: number;
      username: string;
      rating: number;
      color: string;
      avatarUrl?: string;
      countryName?: string;
      chessTitle?: string;
      membershipCode?: string;
      isOnline?: boolean;
      flair?: {
        id: string;
        images: {
          png: string;
          svg: string;
          lottie: string;
        };
      };
    };
  };
}

/**
 * Fetches a single chess.com live game payload by ID.
 * @param gameId - Chess.com live game identifier (numeric string).
 * @throws Error when the id is missing or the request fails for unexpected reasons.
 * @returns Parsed game response JSON, or `null` when Chess.com reports the game is not available.
 *
 * Note:
 * Chess.com commonly returns HTTP 404 for:
 * - non-existent game IDs
 * - games still in progress (results/PGN not yet retrievable)
 *
 * We treat that as a normal "not found" outcome (return `null`) so the client can
 * present a clean, user-friendly message without tripping Next.js server-action
 * error serialization quirks.
 */
export async function fetchChessGame(gameId: string): Promise<ChessGame | null> {
  if (!gameId) {
    throw new Error("Game ID is required");
  }

  try {
    const response = await fetch(
      `https://www.chess.com/callback/live/game/${gameId}`,
      {
        headers: {
          "Accept": "application/json",
        },
      },
    );

    // Chess.com uses 404 for "not found" and often "not ready yet".
    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error("Failed to fetch game data");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching game:", error);
    throw new Error("Failed to fetch game data");
  }
}

/**
 * Attempts to locate the partner game for a bughouse match.
 * - Prefer the `partnerGameId` returned in the original response.
 * - Fallback: probe adjacent game IDs that often contain the paired board.
 * @param originalGameId - ID of the first board.
 * @returns Partner game ID string when found; otherwise null.
 */
export async function findPartnerGameId(
  originalGameId: string,
): Promise<string | null> {
  try {
    // Fetch the original game
    const originalGame = await fetchChessGame(originalGameId);
    if (!originalGame) return null;

    // Directly use the partner game ID if available
    if (originalGame?.game?.partnerGameId) {
      return originalGame.game.partnerGameId.toString();
    }

    // Fallback: search adjacent game IDs
    const candidateIds = [
      parseInt(originalGameId) - 1,
      parseInt(originalGameId) + 1,
      parseInt(originalGameId) - 2,
      parseInt(originalGameId) + 2,
    ];

    for (const id of candidateIds) {
      try {
        const candidateGame = await fetchChessGame(id.toString());
        if (candidateGame?.game?.type === "bughouse") {
          return id.toString();
        }
      } catch {
        // Log errors or continue silently
      }
    }

    return null;
  } catch (error) {
    console.error("Error finding partner game:", error);
    return null;
  }
}

/**
 * Fetches a player's games for a specific month from Chess.com's public API.
 *
 * @param username - Chess.com username (case-insensitive).
 * @param year - Year (e.g., 2025).
 * @param month - Month (1-12).
 * @returns Array of game records, or empty array if the player/month has no games.
 * @throws Error when the request fails for unexpected reasons.
 *
 * Note:
 * - This uses Chess.com's public API which has rate limits.
 * - The API may return 429 (Too Many Requests) if called too frequently.
 * - Games are returned in chronological order within the month.
 *
 * @see https://api.chess.com/pub/player/{username}/games/{year}/{month}
 */
export async function fetchPlayerMonthlyGames(
  username: string,
  year: number,
  month: number,
): Promise<PublicGameRecord[]> {
  if (!username) {
    throw new Error("Username is required");
  }

  // Validate year and month
  if (year < 2000 || year > 2100) {
    throw new Error("Invalid year");
  }
  if (month < 1 || month > 12) {
    throw new Error("Invalid month");
  }

  // Pad month to 2 digits (Chess.com API expects MM format)
  const monthStr = month.toString().padStart(2, "0");

  try {
    const response = await fetch(
      `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/${year}/${monthStr}`,
      {
        headers: {
          Accept: "application/json",
          // Chess.com recommends including a User-Agent with contact info
          "User-Agent": "BughouseAnalysis/1.0 (bughouse.aronteh.com)",
        },
      },
    );

    // 404 means player doesn't exist or has no games for this month
    if (response.status === 404) {
      return [];
    }

    // 429 means rate limited - propagate this so caller can handle
    if (response.status === 429) {
      throw new Error("Rate limited by Chess.com API. Please try again later.");
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch player games: ${response.status}`);
    }

    const data: PublicGamesResponse = await response.json();
    return data.games ?? [];
  } catch (error) {
    // Re-throw rate limit errors as-is
    if (error instanceof Error && error.message.includes("Rate limited")) {
      throw error;
    }
    console.error("Error fetching player monthly games:", error);
    throw new Error("Failed to fetch player games from Chess.com");
  }
}
