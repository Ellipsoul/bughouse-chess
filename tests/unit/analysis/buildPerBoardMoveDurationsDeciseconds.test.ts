import { describe, it, expect } from "vitest";
import { buildPerBoardMoveDurationsDeciseconds } from "../../../app/utils/analysis/buildPerBoardMoveDurationsDeciseconds";
import type { BughouseMove } from "../../../app/types/bughouse";

describe("buildPerBoardMoveDurationsDeciseconds", () => {
  it("computes per-board durations (time since previous move on the same board)", () => {
    const combinedMoves: BughouseMove[] = [
      { board: "B", moveNumber: 1, move: "Nf3", timestamp: 3, side: "white" },
      { board: "A", moveNumber: 1, move: "e4", timestamp: 5, side: "white" },
      { board: "B", moveNumber: 1, move: "Nc6", timestamp: 10, side: "black" },
      { board: "A", moveNumber: 1, move: "e5", timestamp: 12, side: "black" },
    ];

    // Board-local deltas:
    // - B1: 3 - 0 = 3
    // - A1: 5 - 0 = 5
    // - B2: 10 - 3 = 7
    // - A2: 12 - 5 = 7
    expect(buildPerBoardMoveDurationsDeciseconds(combinedMoves)).toEqual([3, 5, 7, 7]);
  });

  it("clamps regressing timestamps per-board so durations never go negative", () => {
    const combinedMoves: BughouseMove[] = [
      { board: "A", moveNumber: 1, move: "e4", timestamp: 5, side: "white" },
      // Regression on board A: timestamp 3 < 5
      { board: "A", moveNumber: 1, move: "e5", timestamp: 3, side: "black" },
      // Board B unaffected; should still compute normally.
      { board: "B", moveNumber: 1, move: "Nf3", timestamp: 2, side: "white" },
    ];

    expect(buildPerBoardMoveDurationsDeciseconds(combinedMoves)).toEqual([5, 0, 2]);
  });

  it("treats non-finite timestamps as 'no additional time elapsed'", () => {
    const combinedMoves: BughouseMove[] = [
      { board: "A", moveNumber: 1, move: "e4", timestamp: Number.NaN, side: "white" },
      { board: "A", moveNumber: 1, move: "e5", timestamp: 4, side: "black" },
    ];

    // First move has invalid timestamp => treated as 0 (previous is 0) => duration 0
    // Second move: 4 - 0 = 4
    expect(buildPerBoardMoveDurationsDeciseconds(combinedMoves)).toEqual([0, 4]);
  });
});
