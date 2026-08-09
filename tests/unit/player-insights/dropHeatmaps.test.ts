import { describe, expect, it } from "vitest";

import {
  buildDropHeatmapLeaderboard,
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
        [emptySquares(), emptySquares(), emptySquares(), emptySquares(), emptySquares()],
        [emptySquares(), emptySquares(), emptySquares(), emptySquares(), emptySquares()],
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

describe("piece drop heat-map leaderboard", () => {
  it("sorts by analyzed games and derives per-piece square proportions", () => {
    const leaderboard = buildDropHeatmapLeaderboard({
      data: fixture,
      query: "",
      colorMode: "combined",
      page: 1,
      pageSize: 25,
    });

    expect(leaderboard.rows.map(({ username }) => username)).toEqual([
      "alice",
      "carol",
      "bob",
    ]);
    expect(leaderboard.rows[0].representedGames).toBe(10);
    expect(leaderboard.rows[0].pieceTotals).toEqual([0, 6, 0, 0, 0]);
    expect(leaderboard.rows[0].probabilities[1].slice(0, 3)).toEqual([5 / 6, 1 / 6, 0]);
    expect(leaderboard.rows[1].probabilities[4]).toEqual(emptySquares());
  });

  it("switches to exact White or Black channels and sorts by that channel's games", () => {
    const white = buildDropHeatmapLeaderboard({
      data: fixture,
      query: "",
      colorMode: "white",
      page: 1,
      pageSize: 25,
    });
    const black = buildDropHeatmapLeaderboard({
      data: fixture,
      query: "",
      colorMode: "black",
      page: 1,
      pageSize: 25,
    });

    expect(white.rows.map(({ username, representedGames }) => [username, representedGames])).toEqual([
      ["alice", 6],
      ["carol", 4],
      ["bob", 1],
    ]);
    expect(white.rows[0].pieceTotals[1]).toBe(4);
    expect(black.rows.map(({ username, representedGames }) => [username, representedGames])).toEqual([
      ["carol", 6],
      ["alice", 5],
      ["bob", 1],
    ]);
    expect(black.rows[1].drops[1][56]).toBe(2);
  });
});
