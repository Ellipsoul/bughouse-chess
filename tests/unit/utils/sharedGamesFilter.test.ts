import { describe, it, expect } from "vitest";
import { filterSharedGames } from "../../../app/utils/sharedGamesFilter";
import type { SharedGameSummary } from "../../../app/types/sharedGame";

/**
 * Creates a mock SharedGameSummary for testing.
 */
function createMockGame(overrides: {
  id?: string;
  type?: SharedGameSummary["type"];
  team1Player1?: string;
  team1Player2?: string;
  team2Player1?: string;
  team2Player2?: string;
  sharerUsername?: string;
}): SharedGameSummary {
  const {
    id = "test-id",
    type = "game",
    team1Player1 = "Player1",
    team1Player2 = "Player2",
    team2Player1 = "Player3",
    team2Player2 = "Player4",
    sharerUsername = "sharer",
  } = overrides;

  return {
    id,
    type,
    sharerUserId: "user-id",
    sharerUsername,
    description: "",
    sharedAt: new Date(),
    gameDate: new Date(),
    metadata: {
      gameCount: 1,
      result: "1 - 0",
      team1: {
        player1: { username: team1Player1 },
        player2: { username: team1Player2 },
      },
      team2: {
        player1: { username: team2Player1 },
        player2: { username: team2Player2 },
      },
    },
  };
}

describe("filterSharedGames", () => {
  describe("No filters", () => {
    it("returns all games when no filters are provided", () => {
      const games = [
        createMockGame({ id: "1", type: "game" }),
        createMockGame({ id: "2", type: "match" }),
        createMockGame({ id: "3", type: "partnerGames" }),
      ];

      const result = filterSharedGames(games, {});

      expect(result).toEqual(games);
      expect(result.length).toBe(3);
    });

    it("returns all games when all filters are empty strings", () => {
      const games = [
        createMockGame({ id: "1" }),
        createMockGame({ id: "2" }),
      ];

      const result = filterSharedGames(games, {
        player1: "",
        player2: "",
        player3: "",
        player4: "",
        sharer: "",
      });

      expect(result).toEqual(games);
    });
  });

  describe("Content type filters", () => {
    it("filters by selected content types", () => {
      const games = [
        createMockGame({ id: "1", type: "game" }),
        createMockGame({ id: "2", type: "match" }),
        createMockGame({ id: "3", type: "partnerGames" }),
      ];

      const result = filterSharedGames(games, {
        includeGame: true,
        includeMatch: false,
        includePartnerGames: true,
      });

      expect(result.length).toBe(2);
      expect(result.map((game) => game.id)).toEqual(["1", "3"]);
    });

    it("returns no games when all content types are excluded", () => {
      const games = [
        createMockGame({ id: "1", type: "game" }),
        createMockGame({ id: "2", type: "match" }),
      ];

      const result = filterSharedGames(games, {
        includeGame: false,
        includeMatch: false,
        includePartnerGames: false,
      });

      expect(result).toEqual([]);
    });
  });

  describe("Sharer filter", () => {
    it("filters by sharer username (case-insensitive)", () => {
      const games = [
        createMockGame({ id: "1", sharerUsername: "Alice" }),
        createMockGame({ id: "2", sharerUsername: "Bob" }),
        createMockGame({ id: "3", sharerUsername: "alice123" }),
      ];

      const result = filterSharedGames(games, { sharer: "alice" });

      expect(result.length).toBe(2);
      expect(result[0]?.id).toBe("1");
      expect(result[1]?.id).toBe("3");
    });

    it("filters by sharer substring", () => {
      const games = [
        createMockGame({ id: "1", sharerUsername: "mmichael" }),
        createMockGame({ id: "2", sharerUsername: "ellipsoul" }),
        createMockGame({ id: "3", sharerUsername: "mmichael123" }),
      ];

      const result = filterSharedGames(games, { sharer: "mm" });

      expect(result.length).toBe(2);
      expect(result[0]?.id).toBe("1");
      expect(result[1]?.id).toBe("3");
    });
  });

  describe("Single player filter (interchangeable positions)", () => {
    it("matches player in team1.player1 position", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "MMichael",
          team1Player2: "Player2",
          team2Player1: "Player3",
          team2Player2: "Player4",
        }),
        createMockGame({ id: "2" }),
      ];

      const result = filterSharedGames(games, { player1: "mm" });

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe("1");
    });

    it("matches player in team1.player2 position", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "Player1",
          team1Player2: "MMichael",
          team2Player1: "Player3",
          team2Player2: "Player4",
        }),
        createMockGame({ id: "2" }),
      ];

      const result = filterSharedGames(games, { player1: "mm" });

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe("1");
    });

    it("matches player in team2.player1 position", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "Player1",
          team1Player2: "Player2",
          team2Player1: "MMichael",
          team2Player2: "Player4",
        }),
        createMockGame({ id: "2" }),
      ];

      const result = filterSharedGames(games, { player1: "mm" });

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe("1");
    });

    it("matches player in team2.player2 position", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "Player1",
          team1Player2: "Player2",
          team2Player1: "Player3",
          team2Player2: "MMichael",
        }),
        createMockGame({ id: "2" }),
      ];

      const result = filterSharedGames(games, { player1: "mm" });

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe("1");
    });

    it("player1 and player2 filters are interchangeable", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "MMichael",
          team1Player2: "Player2",
        }),
      ];

      const result1 = filterSharedGames(games, { player1: "mm" });
      const result2 = filterSharedGames(games, { player2: "mm" });

      expect(result1).toEqual(result2);
      expect(result1.length).toBe(1);
    });

    it("all player filters (1-4) are interchangeable for single filter", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "MMichael",
        }),
      ];

      const results = [
        filterSharedGames(games, { player1: "mm" }),
        filterSharedGames(games, { player2: "mm" }),
        filterSharedGames(games, { player3: "mm" }),
        filterSharedGames(games, { player4: "mm" }),
      ];

      results.forEach((result) => {
        expect(result.length).toBe(1);
        expect(result[0]?.id).toBe("1");
      });
    });

    it("is case-insensitive", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "MMichael",
        }),
      ];

      const result = filterSharedGames(games, { player1: "MMICHAEL" });

      expect(result.length).toBe(1);
    });
  });

  describe("Multiple player filters", () => {
    it("matches two players from same filter group (Player 1/Player 2) on the same team", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "MMichael",
          team1Player2: "xSHYNE", // Same team (team1)
          team2Player1: "Player3",
          team2Player2: "Player4",
        }),
        createMockGame({
          id: "2",
          team1Player1: "Player1",
          team1Player2: "Player2",
          team2Player1: "MMichael",
          team2Player2: "xSHYNE", // Same team (team2)
        }),
        createMockGame({
          id: "3",
          team1Player1: "MMichael",
          team1Player2: "Player2",
          team2Player1: "xSHYNE",
          team2Player2: "Player4", // Opposite teams - should NOT match
        }),
      ];

      const result = filterSharedGames(games, {
        player1: "mm",
        player2: "xshyne",
      });

      // Player 1/Player 2 filters: must be on the same team (either team1 or team2)
      expect(result.length).toBe(2);
      expect(result.map((g) => g.id)).toEqual(["1", "2"]);
    });

    it("matches two players from same filter group (Player 3/Player 4) on the same team", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "Player1",
          team1Player2: "Player2",
          team2Player1: "MMichael",
          team2Player2: "xSHYNE", // Same team (team2)
        }),
        createMockGame({
          id: "2",
          team1Player1: "MMichael",
          team1Player2: "xSHYNE", // Same team (team1)
          team2Player1: "Player3",
          team2Player2: "Player4",
        }),
        createMockGame({
          id: "3",
          team1Player1: "MMichael",
          team1Player2: "Player2",
          team2Player1: "xSHYNE",
          team2Player2: "Player4", // Opposite teams - should NOT match
        }),
      ];

      const result = filterSharedGames(games, {
        player3: "mm",
        player4: "xshyne",
      });

      // Player 3/Player 4 filters: must be on the same team (either team1 or team2)
      expect(result.length).toBe(2);
      expect(result.map((g) => g.id)).toEqual(["1", "2"]);
    });

    it("requires opposite teams when filters are from both groups (Player 1/Player 2 AND Player 3/Player 4)", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "MMichael",
          team1Player2: "Player2",
          team2Player1: "xSHYNE",
          team2Player2: "Player4", // Opposite teams - should match
        }),
        createMockGame({
          id: "2",
          team1Player1: "xSHYNE",
          team1Player2: "Player2",
          team2Player1: "MMichael",
          team2Player2: "Player4", // Opposite teams - should match
        }),
        createMockGame({
          id: "3",
          team1Player1: "MMichael",
          team1Player2: "xSHYNE", // Same team - should NOT match
          team2Player1: "Player3",
          team2Player2: "Player4",
        }),
      ];

      const result = filterSharedGames(games, {
        player1: "mm",
        player3: "xshyne",
      });

      // Player 1 (Team A) and Player 3 (Team B): must be on opposite teams
      expect(result.length).toBe(2);
      expect(result.map((g) => g.id)).toEqual(["1", "2"]);
    });

    it("matches when both players are on the same team (player positions agnostic within team)", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "MMichael",
          team1Player2: "xSHYNE", // Both on team1
          team2Player1: "Player3",
          team2Player2: "Player4",
        }),
        createMockGame({
          id: "2",
          team1Player1: "xSHYNE", // Positions swapped within team
          team1Player2: "MMichael",
          team2Player1: "Player3",
          team2Player2: "Player4",
        }),
      ];

      const result = filterSharedGames(games, {
        player1: "mm",
        player2: "xshyne",
      });

      // Should match both - player positions within team are agnostic
      expect(result.length).toBe(2);
    });

    it("does not match when players are on opposite teams (2 filters require same team)", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "MMichael",
          team1Player2: "Player2",
          team2Player1: "xSHYNE",
          team2Player2: "Player4",
        }),
        createMockGame({
          id: "2",
          team1Player1: "Player1",
          team1Player2: "MMichael",
          team2Player1: "Player3",
          team2Player2: "xSHYNE",
        }),
      ];

      const result = filterSharedGames(games, {
        player1: "mm",
        player2: "xshyne",
      });

      // With 2 filters, must be on same team - opposite teams should NOT match
      expect(result.length).toBe(0);
    });

    it("handles three player filters from both groups (must span both teams)", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "MMichael",
          team1Player2: "xSHYNE", // Team A on team1
          team2Player1: "larso", // Team B on team2
          team2Player2: "Player4",
        }),
        createMockGame({
          id: "2",
          team1Player1: "Player1",
          team1Player2: "Player2",
          team2Player1: "MMichael",
          team2Player2: "xSHYNE", // Team A on team2
          // Missing larso - should not match
        }),
        createMockGame({
          id: "3",
          team1Player1: "MMichael",
          team1Player2: "xSHYNE", // Team A on team1
          team2Player1: "larso", // Team B on team2
          team2Player2: "OtherPlayer",
        }),
        createMockGame({
          id: "4",
          team1Player1: "MMichael",
          team1Player2: "Player2",
          team2Player1: "xSHYNE", // Team A partially on team2
          team2Player2: "larso", // Team B on team2, but Team A has mm on team1 - invalid
        }),
      ];

      const result = filterSharedGames(games, {
        player1: "mm",
        player2: "xshyne", // Team A (must be on same team)
        player3: "larso", // Team B
      });

      // Team A (Player 1/Player 2) must be on same team, Team B (Player 3) must be on opposite team
      // Game 1: Team A on team1, Team B on team2 - valid
      // Game 3: Team A on team1, Team B on team2 - valid
      expect(result.length).toBe(2);
      expect(result.map((g) => g.id)).toEqual(["1", "3"]);
    });

    it("handles four player filters (Team A and Team B must be on opposite teams)", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "MMichael",
          team1Player2: "larso", // Team A on team1
          team2Player1: "xSHYNE",
          team2Player2: "Player4", // Team B on team2
        }),
        createMockGame({
          id: "2",
          team1Player1: "xSHYNE",
          team1Player2: "Player4", // Team B on team1
          team2Player1: "MMichael",
          team2Player2: "larso", // Team A on team2
        }),
        createMockGame({
          id: "3",
          team1Player1: "MMichael",
          team1Player2: "larso", // Team A on team1
          team2Player1: "xSHYNE",
          team2Player2: "Player4", // Team B on team2
        }),
        createMockGame({
          id: "4",
          team1Player1: "MMichael",
          team1Player2: "larso", // Team A on team1
          team2Player1: "Player3",
          team2Player2: "xSHYNE", // Team B partially on team2, but Player4 missing
        }),
      ];

      const result = filterSharedGames(games, {
        player1: "mm",
        player2: "larso", // Team A
        player3: "xshyne",
        player4: "player4", // Team B
      });

      // Team A (Player 1/Player 2) and Team B (Player 3/Player 4): must be on opposite teams
      // Games 1, 2, 3 have both teams properly matched
      expect(result.length).toBe(3);
      expect(result.map((g) => g.id)).toEqual(["1", "2", "3"]);
    });
  });

  describe("Combined filters", () => {
    it("combines sharer and player filters", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "MMichael",
          sharerUsername: "mmichael",
        }),
        createMockGame({
          id: "2",
          team1Player1: "MMichael",
          sharerUsername: "ellipsoul",
        }),
        createMockGame({
          id: "3",
          team1Player1: "OtherPlayer",
          sharerUsername: "mmichael",
        }),
      ];

      const result = filterSharedGames(games, {
        player1: "mm",
        sharer: "mm",
      });

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe("1");
    });
  });

  describe("Edge cases", () => {
    it("handles empty games array", () => {
      const result = filterSharedGames([], { player1: "mm" });

      expect(result).toEqual([]);
    });

    it("handles whitespace in filters", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "MMichael",
        }),
      ];

      const result = filterSharedGames(games, { player1: "  mm  " });

      expect(result.length).toBe(1);
    });

    it("handles no matches", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "OtherPlayer",
        }),
      ];

      const result = filterSharedGames(games, { player1: "nonexistent" });

      expect(result.length).toBe(0);
    });

    it("handles partial substring matches", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "MMichael",
        }),
        createMockGame({
          id: "2",
          team1Player1: "mmichael123",
        }),
        createMockGame({
          id: "3",
          team1Player1: "xMMichael",
        }),
      ];

      const result = filterSharedGames(games, { player1: "mm" });

      expect(result.length).toBe(3);
    });
  });

  describe("Real-world scenarios", () => {
    it("matches MMichael in Player 1 or Player 2 (interchangeable)", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "MMichael",
          team1Player2: "Player2",
        }),
        createMockGame({
          id: "2",
          team1Player1: "Player1",
          team1Player2: "MMichael",
        }),
      ];

      const result1 = filterSharedGames(games, { player1: "mm" });
      const result2 = filterSharedGames(games, { player2: "mm" });

      expect(result1.length).toBe(2);
      expect(result2.length).toBe(2);
      expect(result1).toEqual(result2);
    });

    it("matches MMichael in Player 3/4 anywhere (team position doesn't matter)", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "MMichael",
          team1Player2: "Player2",
        }),
        createMockGame({
          id: "2",
          team2Player1: "MMichael",
          team2Player2: "Player4",
        }),
      ];

      const result = filterSharedGames(games, { player3: "mm" });

      expect(result.length).toBe(2);
    });

    it("matches Ellipsoul and xSHYNE from opposite filter groups on opposite teams", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "Ellipsoul",
          team1Player2: "Player2",
          team2Player1: "xSHYNE",
          team2Player2: "Player4", // Opposite teams - should match
        }),
        createMockGame({
          id: "2",
          team1Player1: "xSHYNE",
          team1Player2: "Player2",
          team2Player1: "Ellipsoul",
          team2Player2: "Player4", // Opposite teams - should match
        }),
        createMockGame({
          id: "3",
          team1Player1: "Ellipsoul",
          team1Player2: "xSHYNE", // Same team - should NOT match (opposite filter groups)
          team2Player1: "Player3",
          team2Player2: "Player4",
        }),
      ];

      const result = filterSharedGames(games, {
        player1: "ellipsoul", // Team A (Player 1/Player 2)
        player3: "xshyne", // Team B (Player 3/Player 4)
      });

      // Player 1 (Team A) and Player 3 (Team B): must be on opposite teams
      expect(result.length).toBe(2);
      expect(result.map((g) => g.id)).toEqual(["1", "2"]);
    });

    it("matches partner games: xSHYNE and Ellipsoul as partners (same filter group, same team)", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "xSHYNE",
          team1Player2: "Ellipsoul",
          team2Player1: "Shadowsax",
          team2Player2: "brookford1983",
        }),
        createMockGame({
          id: "2",
          team1Player1: "Ellipsoul",
          team1Player2: "xSHYNE", // Positions swapped within team
          team2Player1: "RandomPlayer1",
          team2Player2: "RandomPlayer2",
        }),
        createMockGame({
          id: "3",
          team1Player1: "Player1",
          team1Player2: "Player2",
          team2Player1: "xSHYNE",
          team2Player2: "Ellipsoul", // Same team but team2
        }),
        createMockGame({
          id: "4",
          team1Player1: "xSHYNE",
          team1Player2: "OtherPlayer",
          team2Player1: "Ellipsoul",
          team2Player2: "RandomPlayer2", // Opposite teams - should NOT match
        }),
      ];

      const result = filterSharedGames(games, {
        player1: "xshyne", // Team A (Player 1/Player 2)
        player2: "ellipsoul", // Team A (Player 1/Player 2)
      });

      // Player 1/Player 2 filters: must be on same team (either team1 or team2)
      // Should match games 1, 2, and 3 (partners on same team, any team, any position within team)
      // Should NOT match game 4 (opposite teams)
      expect(result.length).toBe(3);
      expect(result.map((g) => g.id)).toEqual(["1", "2", "3"]);
    });

    it("requires opposite teams for 3+ player filters", () => {
      const games = [
        createMockGame({
          id: "1",
          team1Player1: "MMichael",
          team1Player2: "xSHYNE",
          team2Player1: "Ellipsoul",
          team2Player2: "Player4",
        }),
        createMockGame({
          id: "2",
          team1Player1: "MMichael",
          team1Player2: "xSHYNE",
          team2Player1: "Player3",
          team2Player2: "Ellipsoul",
        }),
        createMockGame({
          id: "3",
          team1Player1: "MMichael",
          team1Player2: "xSHYNE",
          team2Player1: "Player3",
          team2Player2: "Player4", // Missing Ellipsoul
        }),
        createMockGame({
          id: "4",
          team1Player1: "MMichael",
          team1Player2: "xSHYNE",
          team2Player1: "Ellipsoul",
          team2Player2: "OtherPlayer", // All 3 on different teams - valid
        }),
      ];

      const result = filterSharedGames(games, {
        player1: "mm",
        player2: "xshyne",
        player3: "ellipsoul",
      });

      // Should match games 1, 2, and 4 (have all 3 players with at least one on each team)
      // Game 3 is missing Ellipsoul
      expect(result.length).toBe(3);
      expect(result.map((g) => g.id)).toEqual(["1", "2", "4"]);
    });
  });
});
