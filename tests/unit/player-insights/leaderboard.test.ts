import { describe, expect, it } from "vitest";

import {
  buildMaterialLeaderboard,
  type MaterialInsightsData,
} from "@/app/components/player-insights/leaderboard";

const fixture: MaterialInsightsData = {
  schemaVersion: 1,
  dataset: {
    version: "dataset-1",
    sourceSnapshotSha256: "a".repeat(64),
    adapterPolicy: "adapter-v1",
    analyzerVersion: "analyzer-v1",
    cohortPolicy: "cohort-v1",
    acceptedGames: 3,
    analyzedGames: 3,
    replayExcludedGames: 0,
    trackedPlayers: 3,
  },
  pieceOrder: ["pawn", "knight", "bishop", "rook", "queen"],
  pieceValues: {
    bughouse: [1.5, 3, 3, 4, 7],
    standard: [1, 3, 3, 5, 9],
  },
  players: [
    {
      username: "alice",
      displayName: "Alice",
      eligibleGames: 2,
      analyzedGames: 2,
      replayExcludedGames: 0,
      pieces: [[4, 0], [0, 0], [0, 0], [1, 0], [0, 0]],
    },
    {
      username: "bob",
      displayName: "Bob",
      eligibleGames: 1,
      analyzedGames: 1,
      replayExcludedGames: 0,
      pieces: [[0, 0], [0, 0], [0, 0], [2, 0], [0, 1]],
    },
    {
      username: "carol",
      displayName: "Carol",
      eligibleGames: 0,
      analyzedGames: 0,
      replayExcludedGames: 0,
      pieces: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    },
  ],
};

describe("material insight leaderboard", () => {
  it("ranks lifetime net material using the selected piece-value preset", () => {
    const bughouse = buildMaterialLeaderboard({
      data: fixture,
      preset: "bughouse",
      insight: "net-material",
      query: "",
      sortKey: "net",
      direction: "desc",
      page: 1,
      pageSize: 25,
    });
    const standard = buildMaterialLeaderboard({
      data: fixture,
      preset: "standard",
      insight: "net-material",
      query: "",
      sortKey: "net",
      direction: "desc",
      page: 1,
      pageSize: 25,
    });

    expect(bughouse.rows.map(({ username, score }) => [username, score])).toEqual([
      ["alice", 10],
      ["bob", 1],
      ["carol", 0],
    ]);
    expect(standard.rows.map(({ username, score }) => [username, score])).toEqual([
      ["alice", 9],
      ["bob", 1],
      ["carol", 0],
    ]);
    expect(bughouse.rows[0].pieces).toEqual([
      { type: "pawn", won: 4, lost: 0, net: 4 },
      { type: "knight", won: 0, lost: 0, net: 0 },
      { type: "bishop", won: 0, lost: 0, net: 0 },
      { type: "rook", won: 1, lost: 0, net: 1 },
      { type: "queen", won: 0, lost: 0, net: 0 },
    ]);
  });

  it("searches, paginates, and sorts per-game material without ranking zero-game players", () => {
    const result = buildMaterialLeaderboard({
      data: fixture,
      preset: "bughouse",
      insight: "net-material-per-game",
      query: "BO",
      sortKey: "net",
      direction: "asc",
      page: 99,
      pageSize: 1,
    });

    expect(result).toMatchObject({
      page: 1,
      pageSize: 1,
      totalRows: 1,
      totalPages: 1,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      username: "bob",
      rank: 1,
      score: 1,
    });

    const full = buildMaterialLeaderboard({
      data: fixture,
      preset: "bughouse",
      insight: "net-material-per-game",
      query: "",
      sortKey: "net",
      direction: "asc",
      page: 1,
      pageSize: 25,
    });
    expect(full.rows.map(({ username, score }) => [username, score])).toEqual([
      ["bob", 1],
      ["alice", 5],
      ["carol", null],
    ]);
  });

  it("sorts by each piece's displayed net count in either direction", () => {
    const mostQueensWon = buildMaterialLeaderboard({
      data: fixture,
      preset: "bughouse",
      insight: "net-material",
      query: "",
      sortKey: "queen",
      direction: "desc",
      page: 1,
      pageSize: 25,
    });
    const mostQueensLost = buildMaterialLeaderboard({
      data: fixture,
      preset: "bughouse",
      insight: "net-material",
      query: "",
      sortKey: "queen",
      direction: "asc",
      page: 1,
      pageSize: 25,
    });

    expect(mostQueensWon.rows.map(({ username }) => username)).toEqual([
      "alice",
      "carol",
      "bob",
    ]);
    expect(mostQueensLost.rows.map(({ username }) => username)).toEqual([
      "bob",
      "alice",
      "carol",
    ]);
  });

  it("sorts by analyzed game count independently of material score", () => {
    const data = {
      ...fixture,
      players: fixture.players.map((player) => ({
        ...player,
        analyzedGames: player.username === "bob" ? 4 : player.analyzedGames,
      })),
    };
    const result = buildMaterialLeaderboard({
      data,
      preset: "bughouse",
      insight: "net-material",
      query: "",
      sortKey: "games",
      direction: "desc",
      page: 1,
      pageSize: 25,
    });

    expect(result.rows.map(({ username, analyzedGames }) => [username, analyzedGames])).toEqual([
      ["bob", 4],
      ["alice", 2],
      ["carol", 0],
    ]);
  });
});
