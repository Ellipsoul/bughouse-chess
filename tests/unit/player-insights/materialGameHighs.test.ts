import { describe, expect, it } from "vitest";

import {
  buildMaterialGameHighsLeaderboard,
  type MaterialGameHighsData,
} from "@/app/components/player-insights/materialGameHighs";

const game = (netMaterialX2: number, id: number) => ({
  url: `https://www.chess.com/game/live/${id}`,
  endTime: 1_700_000_000 + id,
  color: "white" as const,
  fen: "8/8/8/8/8/8/8/8 w - -",
  netMaterialX2,
});

const fixture: MaterialGameHighsData = {
  schemaVersion: 1,
  dataset: {
    version: "dataset-1",
    sourceSnapshotSha256: "a".repeat(64),
    adapterPolicy: "adapter-v1",
    materialGameHighsAnalyzerVersion: "game-highs-v1",
    cohortPolicy: "cohort-v1",
    acceptedGames: 10,
    analyzedGames: 10,
    replayExcludedGames: 0,
    trackedPlayers: 3,
  },
  presetOrder: ["bughouse", "standard"],
  directionOrder: ["won", "lost"],
  players: [
    {
      username: "alice",
      displayName: "Alice",
      analyzedGames: 8,
      gamesByPreset: [
        { won: [game(20, 1), game(14, 2)], lost: [game(-6, 3)] },
        { won: [game(16, 1)], lost: [game(-18, 3)] },
      ],
    },
    {
      username: "bob",
      displayName: "Bob",
      analyzedGames: 4,
      gamesByPreset: [
        { won: [game(12, 4)], lost: [game(-22, 5), game(-10, 6)] },
        { won: [game(24, 4)], lost: [game(-12, 5)] },
      ],
    },
    {
      username: "carol",
      displayName: "Carol",
      analyzedGames: 0,
      gamesByPreset: [
        { won: [], lost: [] },
        { won: [], lost: [] },
      ],
    },
  ],
};

describe("material game-high leaderboard", () => {
  it("ranks by each player's first signed game net for the active preset and direction", () => {
    const won = buildMaterialGameHighsLeaderboard({
      data: fixture,
      preset: "bughouse",
      direction: "won",
      query: "",
      minimumGames: 0,
      page: 1,
      pageSize: 25,
    });
    const lost = buildMaterialGameHighsLeaderboard({
      data: fixture,
      preset: "bughouse",
      direction: "lost",
      query: "",
      minimumGames: 0,
      page: 1,
      pageSize: 25,
    });
    const standardWon = buildMaterialGameHighsLeaderboard({
      data: fixture,
      preset: "standard",
      direction: "won",
      query: "",
      minimumGames: 0,
      page: 1,
      pageSize: 25,
    });

    expect(won.rows.map(({ username, rank, topNetMaterial }) => (
      [username, rank, topNetMaterial]
    ))).toEqual([
      ["alice", 1, 10],
      ["bob", 2, 6],
      ["carol", 3, null],
    ]);
    expect(lost.rows.map(({ username, rank, topNetMaterial }) => (
      [username, rank, topNetMaterial]
    ))).toEqual([
      ["bob", 1, -11],
      ["alice", 2, -3],
      ["carol", 3, null],
    ]);
    expect(standardWon.rows.map(({ username }) => username)).toEqual([
      "bob",
      "alice",
      "carol",
    ]);
  });

  it("filters after ranking and clamps pagination without changing full ranks", () => {
    const result = buildMaterialGameHighsLeaderboard({
      data: fixture,
      preset: "bughouse",
      direction: "won",
      query: "BO",
      minimumGames: 4,
      page: 99,
      pageSize: 1,
    });

    expect(result).toMatchObject({
      page: 1,
      pageSize: 1,
      totalRows: 1,
      totalPages: 1,
    });
    expect(result.rows[0]).toMatchObject({
      username: "bob",
      rank: 2,
      analyzedGames: 4,
      topNetMaterial: 6,
    });
  });
});
