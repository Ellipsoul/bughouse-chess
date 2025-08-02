"use server";

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

export async function fetchChessGame(gameId: string): Promise<ChessGame> {
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

    if (!response.ok) {
      throw new Error("Failed to fetch game data");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching game:", error);
    throw new Error("Failed to fetch game data");
  }
}

export async function findPartnerGameId(
  originalGameId: string,
): Promise<string | null> {
  try {
    // Fetch the original game
    const originalGame = await fetchChessGame(originalGameId);

    // Directly use the partner game ID if available
    if (originalGame?.game?.partnerGameId) {
      console.log("Using partnerGameId from response:", originalGame.game.partnerGameId);
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
          console.log("Found partner game in adjacent ID:", id);
          return id.toString();
        }
      } catch {
        // Log errors or continue silently
      }
    }

    console.log("No partner game found in adjacent IDs.");
    return null;
  } catch (error) {
    console.error("Error finding partner game:", error);
    return null;
  }
}
