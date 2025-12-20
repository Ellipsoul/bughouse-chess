#!/usr/bin/env tsx
/**
 * Records chess.com live game payloads as fixtures for testing.
 *
 * This script fetches the live game JSON for the provided game IDs (and their
 * partner games when available) and saves them to `tests/fixtures/chesscom/`.
 *
 * Usage:
 *   npm run fixtures:record
 *   # or
 *   tsx scripts/recordChessComFixtures.ts [gameId1] [gameId2] ...
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

interface ChessGame {
  game: {
    id: number;
    uuid: string;
    moveList: string;
    type: string;
    typeName: string;
    partnerGameId?: number;
    [key: string]: unknown;
  };
  players: {
    top: unknown;
    bottom: unknown;
  };
  [key: string]: unknown;
}

/**
 * Fetches a single chess.com live game payload by ID.
 */
async function fetchChessGame(gameId: string): Promise<ChessGame> {
  if (!gameId) {
    throw new Error("Game ID is required");
  }

  const response = await fetch(
    `https://www.chess.com/callback/live/game/${gameId}`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch game ${gameId}: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Attempts to locate the partner game for a bughouse match.
 * Mirrors the logic from app/actions.ts.
 */
async function findPartnerGameId(originalGameId: string): Promise<string | null> {
  try {
    const originalGame = await fetchChessGame(originalGameId);

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
        // Continue silently
      }
    }

    return null;
  } catch (error) {
    console.error(`Error finding partner game for ${originalGameId}:`, error);
    return null;
  }
}

/**
 * Records a game and its partner (if found) to fixture files.
 */
async function recordGameFixture(gameId: string, fixturesDir: string): Promise<void> {
  console.log(`Fetching game ${gameId}...`);
  const game = await fetchChessGame(gameId);
  const gamePath = join(fixturesDir, `${gameId}.json`);
  writeFileSync(gamePath, JSON.stringify(game, null, 2), "utf-8");
  console.log(`✓ Saved ${gamePath}`);

  const partnerId = await findPartnerGameId(gameId);
  if (partnerId) {
    console.log(`  Found partner game ${partnerId}...`);
    const partnerGame = await fetchChessGame(partnerId);
    const partnerPath = join(fixturesDir, `${partnerId}.json`);
    writeFileSync(partnerPath, JSON.stringify(partnerGame, null, 2), "utf-8");
    console.log(`  ✓ Saved ${partnerPath}`);
  } else {
    console.log(`  No partner game found for ${gameId}`);
  }
}

/**
 * Main entry point.
 */
async function main() {
  const defaultGameIds = [
    "160064848971",
    "160343849261",
    "160319845633",
    "159889048117",
    "160067249169",
  ];

  const gameIds = process.argv.slice(2).length > 0 ? process.argv.slice(2) : defaultGameIds;
  const fixturesDir = join(process.cwd(), "tests", "fixtures", "chesscom");

  // Ensure fixtures directory exists
  mkdirSync(fixturesDir, { recursive: true });

  console.log(`Recording fixtures for ${gameIds.length} game(s) to ${fixturesDir}...\n`);

  for (const gameId of gameIds) {
    try {
      await recordGameFixture(gameId, fixturesDir);
      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`✗ Failed to record game ${gameId}:`, error);
    }
  }

  console.log(`\n✓ Done! Recorded fixtures for ${gameIds.length} game(s).`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

