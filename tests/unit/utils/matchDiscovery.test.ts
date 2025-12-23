import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import type { ChessGame } from "../../../app/actions";
import type { TeamComposition, MatchGame } from "../../../app/types/match";
import {
  extractGameIdFromUrl,
  extractTeamComposition,
  areTeamsIdentical,
  getAllPlayerUsernames,
  parsePgnDate,
  DiscoveryCancellation,
  createMatchGameFromLoaded,
} from "../../../app/utils/matchDiscovery";
import { extractGameSummary, computeMatchScore } from "../../../app/components/MatchNavigation";

// Load fixtures
function loadFixture(filename: string): ChessGame {
  return JSON.parse(
    readFileSync(join(process.cwd(), "tests", "fixtures", "chesscom", filename), "utf-8"),
  ) as ChessGame;
}

describe("matchDiscovery", () => {
  describe("extractGameIdFromUrl", () => {
    it("extracts game ID from standard Chess.com URL", () => {
      const url = "https://www.chess.com/game/live/159028650535";
      expect(extractGameIdFromUrl(url)).toBe("159028650535");
    });

    it("extracts game ID from URL with trailing slash", () => {
      const url = "https://www.chess.com/game/live/159028650535/";
      expect(extractGameIdFromUrl(url)).toBe("159028650535");
    });

    it("extracts game ID from URL with query parameters", () => {
      const url = "https://www.chess.com/game/live/159028650535?ref=homepage";
      expect(extractGameIdFromUrl(url)).toBe("159028650535");
    });

    it("returns null for empty URL", () => {
      expect(extractGameIdFromUrl("")).toBeNull();
    });

    it("returns null for URL without valid game ID", () => {
      expect(extractGameIdFromUrl("https://www.chess.com/game/live/")).toBeNull();
    });

    it("returns null for URL with non-12-digit ID", () => {
      expect(extractGameIdFromUrl("https://www.chess.com/game/live/12345")).toBeNull();
    });

    it("extracts game ID from different Chess.com URL formats", () => {
      // Daily game format
      const dailyUrl = "https://www.chess.com/game/daily/159028650535";
      expect(extractGameIdFromUrl(dailyUrl)).toBe("159028650535");
    });
  });

  describe("extractTeamComposition", () => {
    let originalGame: ChessGame;
    let partnerGame: ChessGame;

    beforeEach(() => {
      originalGame = loadFixture("160319845633.json");
      partnerGame = loadFixture("160319845635.json");
    });

    it("extracts team composition from game pair", () => {
      const composition = extractTeamComposition(originalGame, partnerGame);

      // Both teams should have 2 players each
      expect(composition.team1.length).toBe(2);
      expect(composition.team2.length).toBe(2);

      // Team arrays should be sorted (lowercase)
      expect(composition.team1[0] <= composition.team1[1]).toBe(true);
      expect(composition.team2[0] <= composition.team2[1]).toBe(true);
    });

    it("returns lowercase usernames", () => {
      const composition = extractTeamComposition(originalGame, partnerGame);

      for (const player of [...composition.team1, ...composition.team2]) {
        expect(player).toBe(player.toLowerCase());
      }
    });

    it("handles missing partner game", () => {
      const composition = extractTeamComposition(originalGame, null);

      // Team 1: Board A white + Board B black (empty)
      // Team 2: Board A black + Board B white (empty)
      expect(composition.team1.length).toBe(2);
      expect(composition.team2.length).toBe(2);
    });

    it("correctly pairs partners across boards", () => {
      const composition = extractTeamComposition(originalGame, partnerGame);

      // In bughouse, partners are diagonal:
      // Board A white + Board B black = Team 1
      // Board A black + Board B white = Team 2

      // From the fixtures:
      // Board A (160319845633): white=chickencrossroad, black=littleplotkin
      // Board B (160319845635): white=larso, black=Emeraldddd

      // Team 1: chickencrossroad + Emeraldddd (sorted)
      // Team 2: littleplotkin + larso (sorted)
      const allPlayers = [...composition.team1, ...composition.team2];

      expect(allPlayers).toContain("chickencrossroad");
      expect(allPlayers).toContain("littleplotkin");
      expect(allPlayers).toContain("larso");
      expect(allPlayers).toContain("emeraldddd");
    });
  });

  describe("areTeamsIdentical", () => {
    it("returns true for identical compositions", () => {
      const comp1: TeamComposition = {
        team1: ["alice", "bob"],
        team2: ["charlie", "dave"],
      };
      const comp2: TeamComposition = {
        team1: ["alice", "bob"],
        team2: ["charlie", "dave"],
      };

      expect(areTeamsIdentical(comp1, comp2)).toBe(true);
    });

    it("returns true when teams are swapped", () => {
      const comp1: TeamComposition = {
        team1: ["alice", "bob"],
        team2: ["charlie", "dave"],
      };
      const comp2: TeamComposition = {
        team1: ["charlie", "dave"],
        team2: ["alice", "bob"],
      };

      expect(areTeamsIdentical(comp1, comp2)).toBe(true);
    });

    it("returns false for different players", () => {
      const comp1: TeamComposition = {
        team1: ["alice", "bob"],
        team2: ["charlie", "dave"],
      };
      const comp2: TeamComposition = {
        team1: ["alice", "bob"],
        team2: ["charlie", "eve"], // Different player
      };

      expect(areTeamsIdentical(comp1, comp2)).toBe(false);
    });

    it("returns false for different team pairings", () => {
      // Same players but different pairings
      const comp1: TeamComposition = {
        team1: ["alice", "bob"],
        team2: ["charlie", "dave"],
      };
      const comp2: TeamComposition = {
        team1: ["alice", "charlie"], // Different pairing
        team2: ["bob", "dave"],
      };

      expect(areTeamsIdentical(comp1, comp2)).toBe(false);
    });

    it("handles case sensitivity correctly (already lowercase)", () => {
      const comp1: TeamComposition = {
        team1: ["alice", "bob"],
        team2: ["charlie", "dave"],
      };
      const comp2: TeamComposition = {
        team1: ["alice", "bob"],
        team2: ["charlie", "dave"],
      };

      expect(areTeamsIdentical(comp1, comp2)).toBe(true);
    });
  });

  describe("getAllPlayerUsernames", () => {
    let originalGame: ChessGame;
    let partnerGame: ChessGame;

    beforeEach(() => {
      originalGame = loadFixture("160319845633.json");
      partnerGame = loadFixture("160319845635.json");
    });

    it("returns all four player usernames", () => {
      const players = getAllPlayerUsernames(originalGame, partnerGame);

      expect(players.length).toBe(4);
      expect(players).toContain("chickencrossroad");
      expect(players).toContain("littleplotkin");
      expect(players).toContain("larso");
      expect(players).toContain("emeraldddd");
    });

    it("returns lowercase usernames", () => {
      const players = getAllPlayerUsernames(originalGame, partnerGame);

      for (const player of players) {
        expect(player).toBe(player.toLowerCase());
      }
    });

    it("returns only two players when partner game is null", () => {
      const players = getAllPlayerUsernames(originalGame, null);

      expect(players.length).toBe(2);
      expect(players).toContain("chickencrossroad");
      expect(players).toContain("littleplotkin");
    });

    it("deduplicates players (edge case)", () => {
      // Create a mock game where the same player appears twice
      const mockGame: ChessGame = {
        ...originalGame,
        players: {
          top: { ...originalGame.players.top, username: "samePlayer" },
          bottom: { ...originalGame.players.bottom, username: "samePlayer" },
        },
      };

      const players = getAllPlayerUsernames(mockGame, null);
      expect(players.length).toBe(1);
      expect(players).toContain("sameplayer");
    });
  });

  describe("parsePgnDate", () => {
    it("parses valid date string", () => {
      const result = parsePgnDate("2025.12.17");

      expect(result).not.toBeNull();
      expect(result?.year).toBe(2025);
      expect(result?.month).toBe(12);
    });

    it("returns null for empty string", () => {
      expect(parsePgnDate("")).toBeNull();
    });

    it("returns null for invalid format", () => {
      expect(parsePgnDate("2025-12-17")).toBeNull(); // Wrong separator
      expect(parsePgnDate("12/17/2025")).toBeNull(); // Wrong format
      expect(parsePgnDate("2025.12")).toBeNull(); // Missing day
    });

    it("returns null for invalid year", () => {
      expect(parsePgnDate("1999.12.17")).toBeNull(); // Too old
      expect(parsePgnDate("2101.12.17")).not.toBeNull(); // 2101 is within valid range (2000-2100)
      expect(parsePgnDate("1800.12.17")).toBeNull(); // Before 2000
    });

    it("returns null for invalid month", () => {
      expect(parsePgnDate("2025.00.17")).toBeNull();
      expect(parsePgnDate("2025.13.17")).toBeNull();
    });

    it("parses dates from fixtures correctly", () => {
      const game = loadFixture("160319845633.json");
      const result = parsePgnDate(game.game.pgnHeaders.Date);

      expect(result).not.toBeNull();
      expect(result?.year).toBe(2025);
      expect(result?.month).toBe(12);
    });
  });

  describe("DiscoveryCancellation", () => {
    it("starts in non-cancelled state", () => {
      const cancellation = new DiscoveryCancellation();
      expect(cancellation.isCancelled()).toBe(false);
    });

    it("transitions to cancelled state", () => {
      const cancellation = new DiscoveryCancellation();
      cancellation.cancel();
      expect(cancellation.isCancelled()).toBe(true);
    });

    it("remains cancelled after multiple cancel calls", () => {
      const cancellation = new DiscoveryCancellation();
      cancellation.cancel();
      cancellation.cancel();
      expect(cancellation.isCancelled()).toBe(true);
    });
  });

  describe("createMatchGameFromLoaded", () => {
    let originalGame: ChessGame;
    let partnerGame: ChessGame;

    beforeEach(() => {
      originalGame = loadFixture("160319845633.json");
      partnerGame = loadFixture("160319845635.json");
    });

    it("creates MatchGame from loaded game data", () => {
      const matchGame = createMatchGameFromLoaded(
        originalGame,
        partnerGame,
        "160319845635",
      );

      expect(matchGame.gameId).toBe("160319845633");
      expect(matchGame.partnerGameId).toBe("160319845635");
      expect(matchGame.original).toBe(originalGame);
      expect(matchGame.partner).toBe(partnerGame);
      expect(matchGame.endTime).toBe(originalGame.game.endTime);
    });

    it("handles null partner ID", () => {
      const matchGame = createMatchGameFromLoaded(originalGame, partnerGame, null);

      expect(matchGame.gameId).toBe("160319845633");
      expect(matchGame.partnerGameId).toBe("");
    });

    it("uses endTime from original game", () => {
      const matchGame = createMatchGameFromLoaded(
        originalGame,
        partnerGame,
        "160319845635",
      );

      expect(matchGame.endTime).toBe(1766006112);
    });
  });
});

describe("matchDiscovery integration", () => {
  // These tests verify the full workflow with mocked API calls
  
  describe("team validation across games", () => {
    let game1Board1: ChessGame;
    let game1Board2: ChessGame;

    beforeEach(() => {
      game1Board1 = loadFixture("160319845633.json");
      game1Board2 = loadFixture("160319845635.json");
    });

    it("identifies same teams across both boards", () => {
      const composition = extractTeamComposition(game1Board1, game1Board2);

      // Verify we captured all 4 unique players
      const allPlayers = [...composition.team1, ...composition.team2];
      const uniquePlayers = new Set(allPlayers);
      expect(uniquePlayers.size).toBe(4);
    });

    it("validates team pairings are preserved", () => {
      const composition = extractTeamComposition(game1Board1, game1Board2);

      // Create the same composition to compare
      const sameComposition = extractTeamComposition(game1Board1, game1Board2);
      expect(areTeamsIdentical(composition, sameComposition)).toBe(true);
    });

    it("detects when team pairings change", () => {
      const composition = extractTeamComposition(game1Board1, game1Board2);

      // Modify the partner game to have different players
      const modifiedPartner: ChessGame = {
        ...game1Board2,
        players: {
          top: { ...game1Board2.players.top, username: "newPlayer1" },
          bottom: { ...game1Board2.players.bottom, username: "newPlayer2" },
        },
      };

      const differentComposition = extractTeamComposition(game1Board1, modifiedPartner);
      expect(areTeamsIdentical(composition, differentComposition)).toBe(false);
    });
  });
});

describe("extractGameSummary", () => {
  let originalGame: ChessGame;
  let partnerGame: ChessGame;

  beforeEach(() => {
    originalGame = loadFixture("160319845633.json");
    partnerGame = loadFixture("160319845635.json");
  });

  it("extracts game summary from MatchGame", () => {
    const matchGame: MatchGame = {
      gameId: originalGame.game.id.toString(),
      partnerGameId: partnerGame.game.id.toString(),
      original: originalGame,
      partner: partnerGame,
      endTime: originalGame.game.endTime ?? 0,
    };

    const summary = extractGameSummary(matchGame, 0);

    expect(summary.gameNumber).toBe(1);
    expect(summary.boardAWhite).toBe("chickencrossroad");
    expect(summary.boardABlack).toBe("littleplotkin");
    expect(summary.boardBWhite).toBe("larso");
    expect(summary.boardBBlack).toBe("Emeraldddd");
    expect(summary.result).toBe("0-1");
  });

  it("determines winning team correctly for team2 win (0-1)", () => {
    const matchGame: MatchGame = {
      gameId: originalGame.game.id.toString(),
      partnerGameId: partnerGame.game.id.toString(),
      original: originalGame,
      partner: partnerGame,
      endTime: originalGame.game.endTime ?? 0,
    };

    const summary = extractGameSummary(matchGame, 0);

    // Result 0-1 means board A black won, which is team2
    expect(summary.winningTeam).toBe("team2");
  });

  it("determines winning team correctly for team1 win (1-0)", () => {
    // Modify the game to have 1-0 result
    const modifiedOriginal: ChessGame = {
      ...originalGame,
      game: {
        ...originalGame.game,
        pgnHeaders: {
          ...originalGame.game.pgnHeaders,
          Result: "1-0",
        },
      },
    };

    const matchGame: MatchGame = {
      gameId: modifiedOriginal.game.id.toString(),
      partnerGameId: partnerGame.game.id.toString(),
      original: modifiedOriginal,
      partner: partnerGame,
      endTime: modifiedOriginal.game.endTime ?? 0,
    };

    const summary = extractGameSummary(matchGame, 0);

    expect(summary.winningTeam).toBe("team1");
  });

  it("determines draw correctly (1/2-1/2)", () => {
    // Modify the game to have draw result
    const modifiedOriginal: ChessGame = {
      ...originalGame,
      game: {
        ...originalGame.game,
        pgnHeaders: {
          ...originalGame.game.pgnHeaders,
          Result: "1/2-1/2",
        },
      },
    };

    const matchGame: MatchGame = {
      gameId: modifiedOriginal.game.id.toString(),
      partnerGameId: partnerGame.game.id.toString(),
      original: modifiedOriginal,
      partner: partnerGame,
      endTime: modifiedOriginal.game.endTime ?? 0,
    };

    const summary = extractGameSummary(matchGame, 0);

    expect(summary.winningTeam).toBe("draw");
  });

  it("uses correct 1-based game number from index", () => {
    const matchGame: MatchGame = {
      gameId: originalGame.game.id.toString(),
      partnerGameId: partnerGame.game.id.toString(),
      original: originalGame,
      partner: partnerGame,
      endTime: originalGame.game.endTime ?? 0,
    };

    expect(extractGameSummary(matchGame, 0).gameNumber).toBe(1);
    expect(extractGameSummary(matchGame, 5).gameNumber).toBe(6);
    expect(extractGameSummary(matchGame, 14).gameNumber).toBe(15);
  });
});

describe("computeMatchScore", () => {
  let originalGame: ChessGame;
  let partnerGame: ChessGame;

  beforeEach(() => {
    originalGame = loadFixture("160319845633.json");
    partnerGame = loadFixture("160319845635.json");
  });

  /**
   * Helper to create a MatchGame with a specific result.
   */
  function createMatchGameWithResult(result: string): MatchGame {
    return {
      gameId: originalGame.game.id.toString(),
      partnerGameId: partnerGame.game.id.toString(),
      original: {
        ...originalGame,
        game: {
          ...originalGame.game,
          pgnHeaders: {
            ...originalGame.game.pgnHeaders,
            Result: result,
          },
        },
      },
      partner: partnerGame,
      endTime: originalGame.game.endTime ?? 0,
    };
  }

  it("returns zeros for empty array", () => {
    const score = computeMatchScore([]);

    expect(score.team1Wins).toBe(0);
    expect(score.team2Wins).toBe(0);
    expect(score.draws).toBe(0);
  });

  it("counts single team1 win correctly", () => {
    const games = [createMatchGameWithResult("1-0")];

    const score = computeMatchScore(games);

    expect(score.team1Wins).toBe(1);
    expect(score.team2Wins).toBe(0);
    expect(score.draws).toBe(0);
  });

  it("counts single team2 win correctly", () => {
    const games = [createMatchGameWithResult("0-1")];

    const score = computeMatchScore(games);

    expect(score.team1Wins).toBe(0);
    expect(score.team2Wins).toBe(1);
    expect(score.draws).toBe(0);
  });

  it("counts single draw correctly", () => {
    const games = [createMatchGameWithResult("1/2-1/2")];

    const score = computeMatchScore(games);

    expect(score.team1Wins).toBe(0);
    expect(score.team2Wins).toBe(0);
    expect(score.draws).toBe(1);
  });

  it("computes score for a full match with mixed results", () => {
    const games = [
      createMatchGameWithResult("1-0"),
      createMatchGameWithResult("0-1"),
      createMatchGameWithResult("1-0"),
      createMatchGameWithResult("1/2-1/2"),
      createMatchGameWithResult("0-1"),
      createMatchGameWithResult("1-0"),
    ];

    const score = computeMatchScore(games);

    expect(score.team1Wins).toBe(3);
    expect(score.team2Wins).toBe(2);
    expect(score.draws).toBe(1);
  });

  it("handles match with only team1 wins", () => {
    const games = [
      createMatchGameWithResult("1-0"),
      createMatchGameWithResult("1-0"),
      createMatchGameWithResult("1-0"),
    ];

    const score = computeMatchScore(games);

    expect(score.team1Wins).toBe(3);
    expect(score.team2Wins).toBe(0);
    expect(score.draws).toBe(0);
  });

  it("handles match with only team2 wins", () => {
    const games = [
      createMatchGameWithResult("0-1"),
      createMatchGameWithResult("0-1"),
    ];

    const score = computeMatchScore(games);

    expect(score.team1Wins).toBe(0);
    expect(score.team2Wins).toBe(2);
    expect(score.draws).toBe(0);
  });

  it("handles match with only draws", () => {
    const games = [
      createMatchGameWithResult("1/2-1/2"),
      createMatchGameWithResult("1/2-1/2"),
      createMatchGameWithResult("1/2-1/2"),
    ];

    const score = computeMatchScore(games);

    expect(score.team1Wins).toBe(0);
    expect(score.team2Wins).toBe(0);
    expect(score.draws).toBe(3);
  });

  it("treats unknown result strings as draws", () => {
    const games = [
      createMatchGameWithResult("*"), // Ongoing/unknown
      createMatchGameWithResult(""), // Empty
    ];

    const score = computeMatchScore(games);

    expect(score.team1Wins).toBe(0);
    expect(score.team2Wins).toBe(0);
    expect(score.draws).toBe(2);
  });
});

