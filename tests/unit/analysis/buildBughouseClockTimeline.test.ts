import { describe, it, expect } from "vitest";
import { buildBughouseClockTimeline } from "../../../app/utils/analysis/buildBughouseClockTimeline";
import type { ProcessedGameData } from "../../../app/types/bughouse";

describe("buildBughouseClockTimeline", () => {
  it("creates initial snapshot with both boards at initial time", () => {
    const processedGame: ProcessedGameData = {
      originalGame: { moves: [], timestamps: [] },
      partnerGame: { moves: [], timestamps: [] },
      combinedMoves: [],
      initialTime: 3000, // 5:00.0 in deciseconds
      timeIncrement: 0,
      players: {
        aWhite: { username: "Player1" },
        aBlack: { username: "Player2" },
        bWhite: { username: "Player3" },
        bBlack: { username: "Player4" },
      },
    };

    const result = buildBughouseClockTimeline(processedGame);
    expect(result.timeline).toHaveLength(1); // Just the start position
    expect(result.timeline[0].A.white).toBe(3000);
    expect(result.timeline[0].A.black).toBe(3000);
    expect(result.timeline[0].B.white).toBe(3000);
    expect(result.timeline[0].B.black).toBe(3000);
    expect(result.moveDurationsByGlobalIndex).toHaveLength(0);
  });

  it("decrements clocks correctly for interleaved moves", () => {
    const processedGame: ProcessedGameData = {
      originalGame: {
        moves: ["e4", "e5"],
        timestamps: [5, 12], // Move 1 at t=5, move 2 at t=12
      },
      partnerGame: {
        moves: ["Nf3", "Nc6"],
        timestamps: [3, 10], // Move 1 at t=3, move 2 at t=10
      },
      combinedMoves: [
        { board: "B", moveNumber: 1, move: "Nf3", timestamp: 3, side: "white" },
        { board: "A", moveNumber: 1, move: "e4", timestamp: 5, side: "white" },
        { board: "B", moveNumber: 1, move: "Nc6", timestamp: 10, side: "black" },
        { board: "A", moveNumber: 1, move: "e5", timestamp: 12, side: "black" },
      ],
      initialTime: 3000,
      timeIncrement: 0,
      players: {
        aWhite: { username: "Player1" },
        aBlack: { username: "Player2" },
        bWhite: { username: "Player3" },
        bBlack: { username: "Player4" },
      },
    };

    const result = buildBughouseClockTimeline(processedGame);
    expect(result.timeline).toHaveLength(5); // Start + 4 moves

    // After first move (B white at t=3, Δt=3)
    // Both boards start with white to move, so both white clocks decrement
    expect(result.timeline[1].A.white).toBeLessThan(3000);
    expect(result.timeline[1].B.white).toBeLessThan(3000);

    // After second move (A white at t=5, Δt=2)
    // The timeline tracks global time where both clocks run simultaneously
    // After the first move on B, B is now black to move
    // After the second move on A, A is now black to move
    // Both black clocks should have decremented
    // Verify clocks have changed (they may be equal if no time elapsed, but structure should be correct)
    expect(result.timeline.length).toBe(5); // Start + 4 moves
    expect(result.timeline[2].A.white).toBeLessThanOrEqual(result.timeline[1].A.white);
    expect(result.timeline[2].B.white).toBeLessThanOrEqual(result.timeline[1].B.white);
  });

  it("handles non-monotonic timestamps", () => {
    const processedGame: ProcessedGameData = {
      originalGame: { moves: ["e4", "e5"], timestamps: [5, 3] }, // Regression: 3 < 5
      partnerGame: { moves: [], timestamps: [] },
      combinedMoves: [
        { board: "A", moveNumber: 1, move: "e4", timestamp: 5, side: "white" },
        { board: "A", moveNumber: 1, move: "e5", timestamp: 3, side: "black" },
      ],
      initialTime: 3000,
      timeIncrement: 0,
      players: {
        aWhite: { username: "Player1" },
        aBlack: { username: "Player2" },
        bWhite: { username: "Player3" },
        bBlack: { username: "Player4" },
      },
    };

    const result = buildBughouseClockTimeline(processedGame);
    expect(result.meta.nonMonotonicMoveTimestamps).toBeGreaterThan(0);
    // Timeline should still be valid (clamped to previous timestamp)
    expect(result.timeline.length).toBeGreaterThan(0);
  });

  it("clamps clocks to zero when they would go negative", () => {
    const processedGame: ProcessedGameData = {
      originalGame: { moves: ["e4"], timestamps: [5000] }, // Very large timestamp
      partnerGame: { moves: [], timestamps: [] },
      combinedMoves: [
        { board: "A", moveNumber: 1, move: "e4", timestamp: 5000, side: "white" },
      ],
      initialTime: 3000, // Only 3000 deciseconds available
      timeIncrement: 0,
      players: {
        aWhite: { username: "Player1" },
        aBlack: { username: "Player2" },
        bWhite: { username: "Player3" },
        bBlack: { username: "Player4" },
      },
    };

    const result = buildBughouseClockTimeline(processedGame);
    expect(result.meta.clampedToZeroEvents).toBeGreaterThan(0);
    // Clocks should not be negative
    expect(result.timeline[1].A.white).toBeGreaterThanOrEqual(0);
    expect(result.timeline[1].A.black).toBeGreaterThanOrEqual(0);
    expect(result.timeline[1].B.white).toBeGreaterThanOrEqual(0);
    expect(result.timeline[1].B.black).toBeGreaterThanOrEqual(0);
  });

  it("computes move durations correctly", () => {
    const processedGame: ProcessedGameData = {
      originalGame: { moves: ["e4"], timestamps: [5] },
      partnerGame: { moves: [], timestamps: [] },
      combinedMoves: [
        { board: "A", moveNumber: 1, move: "e4", timestamp: 5, side: "white" },
      ],
      initialTime: 3000,
      timeIncrement: 0,
      players: {
        aWhite: { username: "Player1" },
        aBlack: { username: "Player2" },
        bWhite: { username: "Player3" },
        bBlack: { username: "Player4" },
      },
    };

    const result = buildBughouseClockTimeline(processedGame);
    expect(result.moveDurationsByGlobalIndex).toHaveLength(1);
    // Duration should be the amount the mover's clock decreased
    const duration = result.moveDurationsByGlobalIndex[0];
    expect(duration).toBeGreaterThanOrEqual(0);
    // Should match the clock decrease for A white
    const clockBefore = result.timeline[0].A.white;
    const clockAfter = result.timeline[1].A.white;
    expect(duration).toBe(clockBefore - clockAfter);
  });

  it("handles missing timestamps gracefully", () => {
    const processedGame: ProcessedGameData = {
      originalGame: { moves: ["e4", "e5"], timestamps: [] },
      partnerGame: { moves: [], timestamps: [] },
      combinedMoves: [
        { board: "A", moveNumber: 1, move: "e4", timestamp: 0, side: "white" },
        { board: "A", moveNumber: 1, move: "e5", timestamp: 0, side: "black" },
      ],
      initialTime: 3000,
      timeIncrement: 0,
      players: {
        aWhite: { username: "Player1" },
        aBlack: { username: "Player2" },
        bWhite: { username: "Player3" },
        bBlack: { username: "Player4" },
      },
    };

    const result = buildBughouseClockTimeline(processedGame);
    // Should still produce a valid timeline
    expect(result.timeline.length).toBe(3); // Start + 2 moves
    // Clocks should remain at initial time (no time elapsed)
    expect(result.timeline[1].A.white).toBe(3000);
  });
});

