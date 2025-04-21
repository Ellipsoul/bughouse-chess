"use server";

interface ChessGame {
  game: {
    moveList: string;
    type: string;
    partnerGameId?: string;
    // Add other properties as needed
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
  // First try to get the partner game ID from the original game
  const originalGame = await fetchChessGame(originalGameId);

  if (originalGame?.game?.partnerGameId) {
    console.log(
      "Partner game ID provided by chess.com:",
      originalGame.game.partnerGameId,
    );
    return originalGame.game.partnerGameId;
  }

  // If no partner ID provided, try adjacent games
  const gameIdNum = parseInt(originalGameId);

  // Check adjacent IDs (typically the partner game is within a few IDs)
  const adjacentIds = [
    gameIdNum - 1,
    gameIdNum + 1,
    gameIdNum - 2,
    gameIdNum + 2,
  ];

  for (const id of adjacentIds) {
    try {
      const game = await fetchChessGame(id.toString());
      // Check if the game exists and is a bughouse game
      if (game?.game?.type === "bughouse") {
        console.log("Found partner game at ID:", id);
        return id.toString();
      }
    } catch {
      // Game doesn't exist or failed to fetch, try next ID
      continue;
    }
  }

  console.log("No partner game found");
  return null;
}
