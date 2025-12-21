"use server";

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
