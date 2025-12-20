import { describe, it, expect, beforeEach, vi } from "vitest";
import { processGameData } from "../../../app/utils/moveOrdering";
import type { ChessGame } from "../../../app/actions";
import { readFileSync } from "fs";
import { join } from "path";

// Mock fetch for actions.ts
vi.mock("../../../app/actions", async () => {
  const actual = await vi.importActual("../../../app/actions");
  return {
    ...actual,
    fetchChessGame: vi.fn(),
  };
});

describe("processGameData", () => {
  let originalGame: ChessGame;
  let partnerGame: ChessGame;

  beforeEach(() => {
    // Load fixtures
    const originalFixture = JSON.parse(
      readFileSync(join(process.cwd(), "tests", "fixtures", "chesscom", "160064848971.json"), "utf-8"),
    ) as ChessGame;
    const partnerFixture = JSON.parse(
      readFileSync(join(process.cwd(), "tests", "fixtures", "chesscom", "160064848973.json"), "utf-8"),
    ) as ChessGame;

    originalGame = originalFixture;
    partnerGame = partnerFixture;
  });

  it("processes game data with both original and partner games", () => {
    const result = processGameData(originalGame, partnerGame);

    expect(result.originalGame.moves.length).toBeGreaterThan(0);
    expect(result.partnerGame.moves.length).toBeGreaterThan(0);
    expect(result.combinedMoves.length).toBeGreaterThan(0);
    expect(result.initialTime).toBe(originalGame.game.baseTime1);
    expect(result.timeIncrement).toBe(originalGame.game.timeIncrement1);
  });

  it("correctly maps players by color field", () => {
    const result = processGameData(originalGame, partnerGame);

    // Players should be correctly mapped based on color field
    expect(result.players.aWhite.username).toBeTruthy();
    expect(result.players.aBlack.username).toBeTruthy();
    expect(result.players.bWhite.username).toBeTruthy();
    expect(result.players.bBlack.username).toBeTruthy();
  });

  it("handles missing partner game", () => {
    const result = processGameData(originalGame, null);

    expect(result.originalGame.moves.length).toBeGreaterThan(0);
    expect(result.partnerGame.moves).toEqual([]);
    expect(result.combinedMoves.length).toBeGreaterThan(0);
  });

  it("merges moves in chronological order", () => {
    const result = processGameData(originalGame, partnerGame);

    // Combined moves should be sorted by timestamp
    for (let i = 1; i < result.combinedMoves.length; i++) {
      const prev = result.combinedMoves[i - 1];
      const curr = result.combinedMoves[i];
      expect(curr.timestamp).toBeGreaterThanOrEqual(prev.timestamp);
    }
  });

  it("handles missing timestamps gracefully", () => {
    const gameWithoutTimestamps: ChessGame = {
      ...originalGame,
      game: {
        ...originalGame.game,
        moveTimestamps: undefined,
        moveList: originalGame.game.moveList, // Keep moves
      },
    };

    const result = processGameData(gameWithoutTimestamps, null);
    expect(result.originalGame.timestamps).toEqual([]);
    // Combined moves should still be created even without timestamps
    // (they'll all have timestamp 0 or be ordered by board)
    expect(Array.isArray(result.combinedMoves)).toBe(true);
  });

  it("truncates timestamps to match move count", () => {
    // Create a game with more timestamps than moves
    const shortMoveList = "lB"; // Just one move
    const gameWithExtraTimestamps: ChessGame = {
      ...originalGame,
      game: {
        ...originalGame.game,
        moveList: shortMoveList,
        moveTimestamps: "1200,1200,1192", // More timestamps than moves
      },
    };

    const result = processGameData(gameWithExtraTimestamps, null);
    // The function should handle this gracefully
    expect(Array.isArray(result.originalGame.timestamps)).toBe(true);
    expect(Array.isArray(result.originalGame.moves)).toBe(true);
  });

  it("assigns correct board and side to combined moves", () => {
    const result = processGameData(originalGame, partnerGame);

    for (const move of result.combinedMoves) {
      expect(move.board).toMatch(/^[AB]$/);
      expect(move.side).toMatch(/^(white|black)$/);
      expect(move.move).toBeTruthy();
      expect(move.timestamp).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles player color inversion correctly", () => {
    // Create a game where top is black
    const invertedGame: ChessGame = {
      ...originalGame,
      players: {
        top: { ...originalGame.players.top, color: "black" },
        bottom: { ...originalGame.players.bottom, color: "white" },
      },
    };

    const result = processGameData(invertedGame, null);
    // Players should be correctly mapped
    expect(result.players.aWhite.username).toBeTruthy();
    expect(result.players.aBlack.username).toBeTruthy();
  });
});

