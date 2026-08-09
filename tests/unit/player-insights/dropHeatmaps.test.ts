import { describe, expect, it } from "vitest";

import {
  deriveDropHeatmapRow,
  deriveTrackedCohortDropHeatmapRow,
  type DropHeatmapInsightsData,
} from "@/app/components/player-insights/dropHeatmaps";

const emptySquares = () => Array.from({ length: 64 }, () => 0);

const fixture: DropHeatmapInsightsData = {
  schemaVersion: 1,
  dataset: {
    version: "dataset-1",
    sourceSnapshotSha256: "a".repeat(64),
    adapterPolicy: "adapter-v1",
    dropHeatmapAnalyzerVersion: "drop-v1",
    cohortPolicy: "cohort-v1",
    acceptedGames: 12,
    analyzedGames: 12,
    replayExcludedGames: 0,
    trackedPlayers: 3,
  },
  pieceOrder: ["pawn", "knight", "bishop", "rook", "queen"],
  squareOrder: Array.from(
    { length: 64 },
    (_, index) => `${"abcdefgh"[index % 8]}${Math.floor(index / 8) + 1}`,
  ),
  players: [
    {
      username: "alice",
      displayName: "Alice",
      analyzedGames: 10,
      analyzedGamesByColor: [6, 5],
      dropsByColor: [
        [emptySquares(), [3, 1, ...emptySquares().slice(2)], emptySquares(), emptySquares(), emptySquares()],
        [emptySquares(), [...emptySquares().slice(0, 56), 2, ...emptySquares().slice(57)], emptySquares(), emptySquares(), emptySquares()],
      ],
    },
    {
      username: "bob",
      displayName: "Bob",
      analyzedGames: 2,
      analyzedGamesByColor: [1, 1],
      dropsByColor: [
        [emptySquares(), [0, 4, ...emptySquares().slice(2)], emptySquares(), emptySquares(), emptySquares()],
        [emptySquares(), [...emptySquares().slice(0, 56), 1, ...emptySquares().slice(57)], emptySquares(), emptySquares(), emptySquares()],
      ],
    },
    {
      username: "carol",
      displayName: "Carol",
      analyzedGames: 10,
      analyzedGamesByColor: [4, 6],
      dropsByColor: [
        [emptySquares(), emptySquares(), emptySquares(), emptySquares(), emptySquares()],
        [emptySquares(), emptySquares(), emptySquares(), emptySquares(), emptySquares()],
      ],
    },
  ],
};

describe("piece drop heat-map rows", () => {
  it("sums permanent-cohort drops but keeps the dataset game denominator", () => {
    const combined = deriveTrackedCohortDropHeatmapRow(fixture, "combined");
    const black = deriveTrackedCohortDropHeatmapRow(fixture, "black");

    expect(combined.displayName).toBe("All tracked players");
    expect(combined.representedGames).toBe(12);
    expect(combined.pieceTotals).toEqual([0, 11, 0, 0, 0]);
    expect(combined.drops[1].slice(0, 2)).toEqual([6, 5]);
    expect(combined.probabilities[1].slice(0, 2)).toEqual([6 / 11, 5 / 11]);
    expect(black.representedGames).toBe(12);
    expect(black.drops[1][56]).toBe(3);
  });

  it("derives combined per-piece square proportions", () => {
    const row = deriveDropHeatmapRow(fixture.players[0], "combined");

    expect(row.representedGames).toBe(10);
    expect(row.pieceTotals).toEqual([0, 6, 0, 0, 0]);
    expect(row.probabilities[1].slice(0, 3)).toEqual([5 / 6, 1 / 6, 0]);
    expect(row.probabilities[4]).toEqual(emptySquares());
  });

  it("switches to exact White or Black channels", () => {
    const white = deriveDropHeatmapRow(fixture.players[0], "white");
    const black = deriveDropHeatmapRow(fixture.players[0], "black");

    expect(white.representedGames).toBe(6);
    expect(white.pieceTotals[1]).toBe(4);
    expect(black.representedGames).toBe(5);
    expect(black.drops[1][56]).toBe(2);
  });
});
