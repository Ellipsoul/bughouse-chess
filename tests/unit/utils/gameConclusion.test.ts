import { describe, it, expect } from "vitest";
import { deriveBughouseConclusionSummary } from "../../../app/utils/gameConclusion";
import type { ChessGame } from "../../../app/actions";
import { readFileSync } from "fs";
import { join } from "path";

describe("deriveBughouseConclusionSummary", () => {
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

  it("extracts conclusion from original game", () => {
    const result = deriveBughouseConclusionSummary(originalGame, partnerGame);
    expect(result).toBeTruthy();
    if (result) {
      expect(result.result).toBeTruthy();
      expect(result.reason).toBeTruthy();
      expect(result.sourceBoard).toMatch(/^[AB]$/);
    }
  });

  it("extracts conclusion from partner game when original lacks it", () => {
    const gameWithoutConclusion: ChessGame = {
      ...originalGame,
      game: {
        ...originalGame.game,
        isFinished: false,
        resultMessage: undefined,
        pgnHeaders: {
          ...originalGame.game.pgnHeaders,
          Result: undefined as unknown as string,
          Termination: undefined as unknown as string,
        },
      },
    };

    const result = deriveBughouseConclusionSummary(gameWithoutConclusion, partnerGame);
    // Should fall back to partner game
    expect(result).toBeTruthy();
  });

  it("returns null when neither game has conclusion data", () => {
    const gameWithoutConclusion: ChessGame = {
      ...originalGame,
      game: {
        ...originalGame.game,
        isFinished: false,
        resultMessage: undefined,
        pgnHeaders: {
          ...originalGame.game.pgnHeaders,
          Result: undefined as unknown as string,
          Termination: undefined as unknown as string,
        },
      },
    };

    const partnerWithoutConclusion: ChessGame = {
      ...partnerGame,
      game: {
        ...partnerGame.game,
        isFinished: false,
        resultMessage: undefined,
        pgnHeaders: {
          ...partnerGame.game.pgnHeaders,
          Result: undefined as unknown as string,
          Termination: undefined as unknown as string,
        },
      },
    };

    const result = deriveBughouseConclusionSummary(gameWithoutConclusion, partnerWithoutConclusion);
    expect(result).toBeNull();
  });

  it("humanizes termination reasons", () => {
    const result = deriveBughouseConclusionSummary(originalGame, partnerGame);
    if (result) {
      // Should be human-readable, not raw API values
      expect(result.reason).not.toContain("_");
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("prefers finished games with explicit termination", () => {
    const finishedGame: ChessGame = {
      ...originalGame,
      game: {
        ...originalGame.game,
        isFinished: true,
        resultMessage: "Checkmate",
        pgnHeaders: {
          ...originalGame.game.pgnHeaders,
          Result: "1-0",
          Termination: "Checkmate",
        },
      },
    };

    const unfinishedGame: ChessGame = {
      ...partnerGame,
      game: {
        ...partnerGame.game,
        isFinished: false,
      },
    };

    const result = deriveBughouseConclusionSummary(finishedGame, unfinishedGame);
    expect(result).toBeTruthy();
    if (result) {
      // Should prefer the finished game
      expect(result.sourceBoard).toBe("A");
    }
  });

  it("handles missing partner game", () => {
    const result = deriveBughouseConclusionSummary(originalGame, null);
    expect(result).toBeTruthy();
    if (result) {
      expect(result.sourceBoard).toBe("A");
    }
  });
});

