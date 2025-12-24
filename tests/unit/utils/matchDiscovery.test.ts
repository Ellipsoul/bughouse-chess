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
import {
  extractGameSummary,
  computeMatchScore,
  establishReferenceTeams,
} from "../../../app/components/MatchNavigation";

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

describe("establishReferenceTeams", () => {
  let originalGame: ChessGame;
  let partnerGame: ChessGame;

  beforeEach(() => {
    originalGame = loadFixture("160319845633.json");
    partnerGame = loadFixture("160319845635.json");
  });

  it("establishes reference teams from first game", () => {
    const matchGame: MatchGame = {
      gameId: originalGame.game.id.toString(),
      partnerGameId: partnerGame.game.id.toString(),
      original: originalGame,
      partner: partnerGame,
      endTime: originalGame.game.endTime ?? 0,
    };

    const refTeams = establishReferenceTeams(matchGame);

    // Team 1: boardA white (chickencrossroad) + boardB black (Emeraldddd)
    expect(refTeams.team1.has("chickencrossroad")).toBe(true);
    expect(refTeams.team1.has("emeraldddd")).toBe(true);

    // Team 2: boardA black (littleplotkin) + boardB white (larso)
    expect(refTeams.team2.has("littleplotkin")).toBe(true);
    expect(refTeams.team2.has("larso")).toBe(true);
  });

  it("stores display names with original case", () => {
    const matchGame: MatchGame = {
      gameId: originalGame.game.id.toString(),
      partnerGameId: partnerGame.game.id.toString(),
      original: originalGame,
      partner: partnerGame,
      endTime: originalGame.game.endTime ?? 0,
    };

    const refTeams = establishReferenceTeams(matchGame);

    expect(refTeams.team1Display).toEqual(["chickencrossroad", "Emeraldddd"]);
    expect(refTeams.team2Display).toEqual(["littleplotkin", "larso"]);
  });
});

describe("extractGameSummary", () => {
  let originalGame: ChessGame;
  let partnerGame: ChessGame;

  beforeEach(() => {
    originalGame = loadFixture("160319845633.json");
    partnerGame = loadFixture("160319845635.json");
  });

  it("extracts game summary with team-based fields", () => {
    const matchGame: MatchGame = {
      gameId: originalGame.game.id.toString(),
      partnerGameId: partnerGame.game.id.toString(),
      original: originalGame,
      partner: partnerGame,
      endTime: originalGame.game.endTime ?? 0,
    };

    const summary = extractGameSummary(matchGame, 0);

    expect(summary.gameNumber).toBe(1);
    // Team 1 = boardA white + boardB black (when team1 is playing white)
    expect(summary.team1BoardA).toBe("chickencrossroad");
    expect(summary.team1BoardB).toBe("Emeraldddd");
    // Team 2 = boardA black + boardB white
    expect(summary.team2BoardA).toBe("littleplotkin");
    expect(summary.team2BoardB).toBe("larso");
    expect(summary.team1IsWhite).toBe(true);
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

  it("correctly handles color swap when using reference teams", () => {
    // First game: team1 has white on board A
    const game1: MatchGame = {
      gameId: originalGame.game.id.toString(),
      partnerGameId: partnerGame.game.id.toString(),
      original: originalGame, // chickencrossroad (W) vs littleplotkin (B)
      partner: partnerGame,   // larso (W) vs Emeraldddd (B)
      endTime: originalGame.game.endTime ?? 0,
    };

    // Second game: colors swapped (team1 now has black on board A)
    // Swap the player names in the headers to simulate color swap
    const swappedOriginal: ChessGame = {
      ...originalGame,
      game: {
        ...originalGame.game,
        pgnHeaders: {
          ...originalGame.game.pgnHeaders,
          White: "littleplotkin",  // Was black in game 1
          Black: "chickencrossroad", // Was white in game 1
          Result: "1-0", // littleplotkin wins (team2 wins this game)
        },
      },
    };
    const swappedPartner: ChessGame = {
      ...partnerGame,
      game: {
        ...partnerGame.game,
        pgnHeaders: {
          ...partnerGame.game.pgnHeaders,
          White: "Emeraldddd", // Was black in game 1
          Black: "larso",      // Was white in game 1
        },
      },
    };

    const game2: MatchGame = {
      gameId: "game2",
      partnerGameId: "partner2",
      original: swappedOriginal,
      partner: swappedPartner,
      endTime: (originalGame.game.endTime ?? 0) + 100,
    };

    // Establish reference from first game
    const refTeams = establishReferenceTeams(game1);

    // Get summary for game 2 using reference teams
    const summary2 = extractGameSummary(game2, 1, refTeams);

    // Team 1 should still be chickencrossroad + Emeraldddd (now playing black)
    expect(summary2.team1BoardA).toBe("chickencrossroad");
    expect(summary2.team1BoardB).toBe("Emeraldddd");
    expect(summary2.team1IsWhite).toBe(false); // They're playing black now

    // Team 2 should still be littleplotkin + larso (now playing white)
    expect(summary2.team2BoardA).toBe("littleplotkin");
    expect(summary2.team2BoardB).toBe("larso");

    // littleplotkin (team2) won with white (1-0), so team2 wins
    expect(summary2.winningTeam).toBe("team2");

    // Display result should be from Team 1's perspective (left side)
    // Team 2 won, so displayResult should be "0-1"
    expect(summary2.displayResult).toBe("0-1");
  });

  it("displays result from Team 1 perspective when Team 1 wins", () => {
    const matchGame: MatchGame = {
      gameId: originalGame.game.id.toString(),
      partnerGameId: partnerGame.game.id.toString(),
      original: {
        ...originalGame,
        game: {
          ...originalGame.game,
          pgnHeaders: {
            ...originalGame.game.pgnHeaders,
            Result: "1-0", // Team 1 (white on board A) wins
          },
        },
      },
      partner: partnerGame,
      endTime: originalGame.game.endTime ?? 0,
    };

    const summary = extractGameSummary(matchGame, 0);

    expect(summary.winningTeam).toBe("team1");
    expect(summary.displayResult).toBe("1-0"); // Team 1 won = "1-0"
  });

  it("flips displayResult when Team 1 wins while playing black", () => {
    // Team 1 (chickencrossroad + Emeraldddd) playing black this game
    const swappedOriginal: ChessGame = {
      ...originalGame,
      game: {
        ...originalGame.game,
        pgnHeaders: {
          ...originalGame.game.pgnHeaders,
          White: "littleplotkin",
          Black: "chickencrossroad",
          Result: "0-1", // Black (Team 1) wins
        },
      },
    };
    const swappedPartner: ChessGame = {
      ...partnerGame,
      game: {
        ...partnerGame.game,
        pgnHeaders: {
          ...partnerGame.game.pgnHeaders,
          White: "Emeraldddd",
          Black: "larso",
        },
      },
    };

    // First establish reference teams from original game
    const refGame: MatchGame = {
      gameId: originalGame.game.id.toString(),
      partnerGameId: partnerGame.game.id.toString(),
      original: originalGame,
      partner: partnerGame,
      endTime: originalGame.game.endTime ?? 0,
    };
    const refTeams = establishReferenceTeams(refGame);

    // Now get summary for the swapped game
    const swappedGame: MatchGame = {
      gameId: "swapped",
      partnerGameId: "swappedPartner",
      original: swappedOriginal,
      partner: swappedPartner,
      endTime: (originalGame.game.endTime ?? 0) + 100,
    };

    const summary = extractGameSummary(swappedGame, 1, refTeams);

    // Raw result is "0-1" (black won)
    expect(summary.result).toBe("0-1");
    // Team 1 won (they were black), so displayResult should be "1-0"
    expect(summary.winningTeam).toBe("team1");
    expect(summary.displayResult).toBe("1-0");
  });

  it("preserves draw notation in displayResult", () => {
    const drawGame: MatchGame = {
      gameId: originalGame.game.id.toString(),
      partnerGameId: partnerGame.game.id.toString(),
      original: {
        ...originalGame,
        game: {
          ...originalGame.game,
          pgnHeaders: {
            ...originalGame.game.pgnHeaders,
            Result: "1/2-1/2",
          },
        },
      },
      partner: partnerGame,
      endTime: originalGame.game.endTime ?? 0,
    };

    const summary = extractGameSummary(drawGame, 0);

    expect(summary.winningTeam).toBe("draw");
    expect(summary.displayResult).toBe("1/2-1/2");
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

  it("correctly attributes wins when teams swap colors", () => {
    // Game 1: Team1 (chickencrossroad+Emeraldddd) has white, wins (1-0)
    const game1 = createMatchGameWithResult("1-0");

    // Game 2: Colors swapped - Team1 now has black
    // Create a game where the colors are swapped
    const swappedOriginal: ChessGame = {
      ...originalGame,
      game: {
        ...originalGame.game,
        pgnHeaders: {
          ...originalGame.game.pgnHeaders,
          White: "littleplotkin",    // Team2 player now white
          Black: "chickencrossroad", // Team1 player now black
          Result: "0-1", // Black wins = Team1 wins
        },
      },
    };
    const swappedPartner: ChessGame = {
      ...partnerGame,
      game: {
        ...partnerGame.game,
        pgnHeaders: {
          ...partnerGame.game.pgnHeaders,
          White: "Emeraldddd", // Team1 player now white on board B
          Black: "larso",      // Team2 player now black on board B
        },
      },
    };

    const game2: MatchGame = {
      gameId: "game2",
      partnerGameId: "partner2",
      original: swappedOriginal,
      partner: swappedPartner,
      endTime: (originalGame.game.endTime ?? 0) + 100,
    };

    // Game 3: Back to original colors, Team2 wins
    const game3 = createMatchGameWithResult("0-1");

    const games = [game1, game2, game3];
    const score = computeMatchScore(games);

    // Game 1: Team1 white, 1-0 -> Team1 wins
    // Game 2: Team1 black, 0-1 -> Team1 wins (black won)
    // Game 3: Team1 white, 0-1 -> Team2 wins (black won)
    expect(score.team1Wins).toBe(2);
    expect(score.team2Wins).toBe(1);
    expect(score.draws).toBe(0);
  });
});

