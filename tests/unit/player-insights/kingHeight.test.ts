import { describe, expect, it } from "vitest";

import {
  buildKingHeightLeaderboard,
  type KingHeightInsightsData,
} from "@/app/components/player-insights/kingHeight";

const fixture: KingHeightInsightsData = {
  schemaVersion: 1,
  dataset: {
    version: "dataset-1",
    sourceSnapshotSha256: "a".repeat(64),
    adapterPolicy: "adapter-v1",
    kingHeightAnalyzerVersion: "king-height-v1",
    cohortPolicy: "cohort-v1",
    acceptedGames: 4,
    analyzedGames: 4,
    replayExcludedGames: 0,
    trackedPlayers: 3,
  },
  heightOrder: [1, 2, 3, 4, 5, 6, 7, 8],
  players: [
    {
      username: "alice",
      displayName: "Alice",
      analyzedGames: 2,
      heights: [1, 0, 1, 0, 0, 0, 0, 0],
      heightEightGames: [],
    },
    {
      username: "bob",
      displayName: "Bob",
      analyzedGames: 2,
      heights: [0, 0, 0, 0, 1, 0, 0, 1],
      heightEightGames: [
        {
          url: "https://www.chess.com/game/live/123",
          endTime: 1700000000,
          color: "black",
        },
      ],
    },
    {
      username: "carol",
      displayName: "Carol",
      analyzedGames: 0,
      heights: [0, 0, 0, 0, 0, 0, 0, 0],
      heightEightGames: [],
    },
  ],
};

describe("average king height leaderboard", () => {
  it("sorts by expected height and derives eight probabilities without dividing by zero", () => {
    const safest = buildKingHeightLeaderboard({
      data: fixture,
      query: "",
      direction: "asc",
      page: 1,
      pageSize: 25,
    });
    const adventurous = buildKingHeightLeaderboard({
      data: fixture,
      query: "",
      direction: "desc",
      page: 1,
      pageSize: 25,
    });

    expect(safest.rows.map(({ username, averageHeight }) => [username, averageHeight])).toEqual([
      ["alice", 2],
      ["bob", 6.5],
      ["carol", null],
    ]);
    expect(adventurous.rows.map(({ username }) => username)).toEqual([
      "bob",
      "alice",
      "carol",
    ]);
    expect(safest.rows[0].probabilities).toEqual([0.5, 0, 0.5, 0, 0, 0, 0, 0]);
    expect(safest.rows[2].probabilities).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("keeps only players meeting the inclusive minimum-game threshold", () => {
    const dataWithThinSample: KingHeightInsightsData = {
      ...fixture,
      players: [
        {
          username: "thin-sample",
          displayName: "Thin Sample",
          analyzedGames: 1,
          heights: [1, 0, 0, 0, 0, 0, 0, 0],
          heightEightGames: [],
        },
        ...fixture.players,
      ],
    };
    const leaderboard = buildKingHeightLeaderboard({
      data: dataWithThinSample,
      query: "",
      direction: "asc",
      minimumGames: 2,
      page: 1,
      pageSize: 25,
    });

    expect(leaderboard.rows.map(({ username, rank }) => [username, rank])).toEqual([
      ["alice", 1],
      ["bob", 2],
    ]);
    expect(leaderboard.totalRows).toBe(2);
  });

  it("sorts touchdown counts in both directions with username tie-breaking", () => {
    const mostTouchdowns = buildKingHeightLeaderboard({
      data: fixture,
      query: "",
      direction: "desc",
      minimumGames: 0,
      page: 1,
      pageSize: 25,
      sortKey: "touchdowns",
    });
    const fewestTouchdowns = buildKingHeightLeaderboard({
      data: fixture,
      query: "",
      direction: "asc",
      minimumGames: 0,
      page: 1,
      pageSize: 25,
      sortKey: "touchdowns",
    });

    expect(mostTouchdowns.rows.map(({ username }) => username)).toEqual([
      "bob",
      "alice",
      "carol",
    ]);
    expect(fewestTouchdowns.rows.map(({ username }) => username)).toEqual([
      "alice",
      "carol",
      "bob",
    ]);
  });
});
