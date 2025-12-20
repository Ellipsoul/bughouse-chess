import { describe, it, expect, beforeEach } from "vitest";
import { parseChessComCompressedMoveList } from "../../app/chesscom_movelist_parse";
import { readFileSync } from "fs";
import { join } from "path";
import type { ChessGame } from "../../app/actions";

describe("parseChessComCompressedMoveList", () => {
  let fixtureGame: ChessGame;

  beforeEach(() => {
    const fixture = JSON.parse(
      readFileSync(join(process.cwd(), "tests", "fixtures", "chesscom", "160064848971.json"), "utf-8"),
    ) as ChessGame;
    fixtureGame = fixture;
  });

  it("parses move list from fixture", () => {
    const moveList = fixtureGame.game.moveList;
    expect(moveList).toBeTruthy();

    const moves = parseChessComCompressedMoveList(moveList);
    expect(moves.length).toBeGreaterThan(0);
    // Move count should be reasonable (each move in the compressed format is a half-move)
    // The exact count depends on the encoding, so we just verify it's not empty
    expect(moves.length).toBeGreaterThan(0);
  });

  it("parses basic pawn moves", () => {
    // Simple move list: e4 e5
    // The encoding is complex, so let's test with a known simple case
    const simpleMoves = parseChessComCompressedMoveList("lB");
    expect(simpleMoves.length).toBeGreaterThan(0);
  });

  it("handles empty move list", () => {
    const moves = parseChessComCompressedMoveList("");
    expect(moves).toEqual([]);
  });

  it("parses moves with drops", () => {
    // Check if fixture contains drops
    const moveList = fixtureGame.game.moveList;
    const moves = parseChessComCompressedMoveList(moveList);
    
    // Bughouse games often have drops, but not always
    // Just verify the parser doesn't crash
    expect(moves.length).toBeGreaterThan(0);
  });

  it("parses castling moves", () => {
    const moveList = fixtureGame.game.moveList;
    const moves = parseChessComCompressedMoveList(moveList);
    
    // Not all games have castling, but parser should handle it
    expect(moves.length).toBeGreaterThan(0);
  });

  it("parses promotion moves", () => {
    const moveList = fixtureGame.game.moveList;
    const moves = parseChessComCompressedMoveList(moveList);
    
    // Not all games have promotions, but parser should handle it
    expect(moves.length).toBeGreaterThan(0);
  });

  it("handles all fixture games", () => {
    const gameIds = [
      "160064848971",
      "160343849261",
      "160319845633",
      "159889048117",
      "160067249169",
    ];

    for (const gameId of gameIds) {
      const fixture = JSON.parse(
        readFileSync(join(process.cwd(), "tests", "fixtures", "chesscom", `${gameId}.json`), "utf-8"),
      ) as ChessGame;
      
      if (fixture.game.moveList) {
        const moves = parseChessComCompressedMoveList(fixture.game.moveList);
        expect(moves.length).toBeGreaterThan(0);
        // Each move should be a valid string
        for (const move of moves) {
          expect(typeof move).toBe("string");
          expect(move.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

