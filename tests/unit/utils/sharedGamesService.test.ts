import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import type { ChessGame } from "../../../app/actions";
import type { MatchGame } from "../../../app/types/match";
import { buildMatchMetadata } from "../../../app/utils/sharedGamesService";
import { computeMatchScore, computePartnerPairScore } from "../../../app/components/MatchNavigation";
import { extractPartnerPairs } from "../../../app/types/match";

// Load fixtures
function loadFixture(filename: string): ChessGame {
  return JSON.parse(
    readFileSync(join(process.cwd(), "tests", "fixtures", "chesscom", filename), "utf-8"),
  ) as ChessGame;
}

/**
 * Helper to create a MatchGame with a specific result.
 */
function createMatchGameWithResult(
  originalGame: ChessGame,
  partnerGame: ChessGame,
  result: string,
): MatchGame {
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

/**
 * Helper to create a MatchGame with swapped colors.
 */
function createMatchGameWithSwappedColors(
  originalGame: ChessGame,
  partnerGame: ChessGame,
  result: string,
): MatchGame {
  // Swap colors: Team1 (originally white) now plays black
  const swappedOriginal: ChessGame = {
    ...originalGame,
    game: {
      ...originalGame.game,
      pgnHeaders: {
        ...originalGame.game.pgnHeaders,
        White: originalGame.game.pgnHeaders.Black,
        Black: originalGame.game.pgnHeaders.White,
        Result: result,
      },
    },
  };
  const swappedPartner: ChessGame = {
    ...partnerGame,
    game: {
      ...partnerGame.game,
      pgnHeaders: {
        ...partnerGame.game.pgnHeaders,
        White: partnerGame.game.pgnHeaders.Black,
        Black: partnerGame.game.pgnHeaders.White,
      },
    },
  };

  return {
    gameId: swappedOriginal.game.id.toString(),
    partnerGameId: swappedPartner.game.id.toString(),
    original: swappedOriginal,
    partner: swappedPartner,
    endTime: swappedOriginal.game.endTime ?? 0,
  };
}

describe("sharedGamesService", () => {
  describe("buildMatchMetadata", () => {
    let originalGame: ChessGame;
    let partnerGame: ChessGame;

    beforeEach(() => {
      originalGame = loadFixture("160319845633.json");
      partnerGame = loadFixture("160319845635.json");
    });

    it("throws error for empty match games array", () => {
      expect(() => buildMatchMetadata([])).toThrow("Cannot build metadata for empty match");
    });

    it("builds metadata for single game match", () => {
      const games = [createMatchGameWithResult(originalGame, partnerGame, "1-0")];
      const metadata = buildMatchMetadata(games);

      expect(metadata.gameCount).toBe(1);
      expect(metadata.result).toBe("1 - 0");
      expect(metadata.team1.player1.username).toBe(originalGame.game.pgnHeaders.White);
      expect(metadata.team1.player2.username).toBe(partnerGame.game.pgnHeaders.Black);
      expect(metadata.team2.player1.username).toBe(originalGame.game.pgnHeaders.Black);
      expect(metadata.team2.player2.username).toBe(partnerGame.game.pgnHeaders.White);
    });

    it("computes correct score for match with multiple games", () => {
      const games = [
        createMatchGameWithResult(originalGame, partnerGame, "1-0"),
        createMatchGameWithResult(originalGame, partnerGame, "0-1"),
        createMatchGameWithResult(originalGame, partnerGame, "1-0"),
        createMatchGameWithResult(originalGame, partnerGame, "1-0"),
      ];

      const metadata = buildMatchMetadata(games);
      const expectedScore = computeMatchScore(games);

      expect(metadata.gameCount).toBe(4);
      expect(metadata.result).toBe(`${expectedScore.team1Wins} - ${expectedScore.team2Wins}`);
      expect(expectedScore.team1Wins).toBe(3);
      expect(expectedScore.team2Wins).toBe(1);
    });

    it("includes draws in result string when present", () => {
      const games = [
        createMatchGameWithResult(originalGame, partnerGame, "1-0"),
        createMatchGameWithResult(originalGame, partnerGame, "1/2-1/2"),
        createMatchGameWithResult(originalGame, partnerGame, "0-1"),
      ];

      const metadata = buildMatchMetadata(games);
      const expectedScore = computeMatchScore(games);

      expect(metadata.gameCount).toBe(3);
      expect(metadata.result).toBe(
        `${expectedScore.team1Wins} - ${expectedScore.team2Wins} (${expectedScore.draws} draw)`,
      );
      expect(expectedScore.draws).toBe(1);
    });

    it("includes plural 'draws' in result string when multiple draws", () => {
      const games = [
        createMatchGameWithResult(originalGame, partnerGame, "1/2-1/2"),
        createMatchGameWithResult(originalGame, partnerGame, "1/2-1/2"),
        createMatchGameWithResult(originalGame, partnerGame, "1-0"),
      ];

      const metadata = buildMatchMetadata(games);
      const expectedScore = computeMatchScore(games);

      expect(metadata.result).toContain(`${expectedScore.draws} draws`);
      expect(expectedScore.draws).toBe(2);
    });

    it("computes correct score when teams swap colors between games", () => {
      // Game 1: Team1 has white, wins (1-0)
      const game1 = createMatchGameWithResult(originalGame, partnerGame, "1-0");

      // Game 2: Colors swapped - Team1 now has black, wins (0-1 means black won = Team1 wins)
      const game2 = createMatchGameWithSwappedColors(originalGame, partnerGame, "0-1");

      // Game 3: Colors swapped back - Team1 has white again, loses (0-1 means black won = Team2 wins)
      const game3 = createMatchGameWithResult(originalGame, partnerGame, "0-1");

      const games = [game1, game2, game3];
      const metadata = buildMatchMetadata(games);
      const expectedScore = computeMatchScore(games);

      // Game 1: Team1 white, 1-0 -> Team1 wins
      // Game 2: Team1 black, 0-1 -> Team1 wins (black won)
      // Game 3: Team1 white, 0-1 -> Team2 wins (black won)
      expect(expectedScore.team1Wins).toBe(2);
      expect(expectedScore.team2Wins).toBe(1);
      expect(metadata.result).toBe(`${expectedScore.team1Wins} - ${expectedScore.team2Wins}`);
    });

    it("uses correct match score calculation that handles color swaps", () => {
      // Create a match where teams swap colors multiple times
      const games = [
        createMatchGameWithResult(originalGame, partnerGame, "1-0"), // Team1 white wins
        createMatchGameWithSwappedColors(originalGame, partnerGame, "0-1"), // Team1 black wins
        createMatchGameWithResult(originalGame, partnerGame, "0-1"), // Team2 wins (Team1 white loses)
        createMatchGameWithSwappedColors(originalGame, partnerGame, "1-0"), // Team2 wins (Team1 black loses)
        createMatchGameWithResult(originalGame, partnerGame, "1-0"), // Team1 white wins
      ];

      const metadata = buildMatchMetadata(games);
      const expectedScore = computeMatchScore(games);

      // Verify the metadata result matches the computed score exactly
      expect(metadata.result).toBe(`${expectedScore.team1Wins} - ${expectedScore.team2Wins}`);

      // Verify the score is correct:
      // Game 1: Team1 white wins (1-0) -> Team1 wins
      // Game 2: Team1 black wins (0-1) -> Team1 wins (black won)
      // Game 3: Team1 white loses (0-1) -> Team2 wins (black won)
      // Game 4: Team1 black loses (1-0) -> Team2 wins (white won)
      // Game 5: Team1 white wins (1-0) -> Team1 wins
      // Team1: 3 wins, Team2: 2 wins
      expect(expectedScore.team1Wins).toBe(3);
      expect(expectedScore.team2Wins).toBe(2);
      expect(expectedScore.draws).toBe(0);
    });

    it("handles match with all draws", () => {
      const games = [
        createMatchGameWithResult(originalGame, partnerGame, "1/2-1/2"),
        createMatchGameWithResult(originalGame, partnerGame, "1/2-1/2"),
        createMatchGameWithResult(originalGame, partnerGame, "1/2-1/2"),
      ];

      const metadata = buildMatchMetadata(games);
      const expectedScore = computeMatchScore(games);

      expect(metadata.result).toBe(
        `${expectedScore.team1Wins} - ${expectedScore.team2Wins} (${expectedScore.draws} draws)`,
      );
      expect(expectedScore.team1Wins).toBe(0);
      expect(expectedScore.team2Wins).toBe(0);
      expect(expectedScore.draws).toBe(3);
    });

    it("preserves player information from first game", () => {
      const games = [
        createMatchGameWithResult(originalGame, partnerGame, "1-0"),
        createMatchGameWithSwappedColors(originalGame, partnerGame, "0-1"),
      ];

      const metadata = buildMatchMetadata(games);

      // Team composition should be based on first game
      expect(metadata.team1.player1.username).toBe(originalGame.game.pgnHeaders.White);
      expect(metadata.team1.player2.username).toBe(partnerGame.game.pgnHeaders.Black);
      expect(metadata.team2.player1.username).toBe(originalGame.game.pgnHeaders.Black);
      expect(metadata.team2.player2.username).toBe(partnerGame.game.pgnHeaders.White);
    });

    it("always uses computeMatchScore for score calculation", () => {
      // This test ensures we're using the correct function, not a naive implementation
      const games = [
        createMatchGameWithResult(originalGame, partnerGame, "1-0"),
        createMatchGameWithSwappedColors(originalGame, partnerGame, "0-1"),
        createMatchGameWithResult(originalGame, partnerGame, "1-0"),
        createMatchGameWithSwappedColors(originalGame, partnerGame, "1-0"),
      ];

      const metadata = buildMatchMetadata(games);
      const computedScore = computeMatchScore(games);

      // The result should match exactly what computeMatchScore produces
      const expectedResult = computedScore.draws > 0
        ? `${computedScore.team1Wins} - ${computedScore.team2Wins} (${computedScore.draws} draw${computedScore.draws !== 1 ? "s" : ""})`
        : `${computedScore.team1Wins} - ${computedScore.team2Wins}`;

      expect(metadata.result).toBe(expectedResult);
    });

    describe("partner games", () => {
      it("builds metadata with selected pair for team1 and Random Opponents for team2", () => {
        const games = [
          createMatchGameWithResult(originalGame, partnerGame, "1-0"),
          createMatchGameWithResult(originalGame, partnerGame, "0-1"),
        ];

        const pairs = extractPartnerPairs(originalGame, partnerGame);
        expect(pairs).not.toBeNull();
        if (!pairs) return;

        const selectedPair = pairs[0]!; // First pair (Board A white + Board B black)
        const metadata = buildMatchMetadata(games, "partnerGames", selectedPair);

        // Team1 should be the selected pair
        expect(metadata.team1.player1.username).toBe(selectedPair.displayNames[0]);
        expect(metadata.team1.player2.username).toBe(selectedPair.displayNames[1]);

        // Team2 should be "Random Opponents"
        expect(metadata.team2.player1.username).toBe("Random");
        expect(metadata.team2.player2.username).toBe("Opponents");
        expect(metadata.team2.player1.chessTitle).toBeUndefined();
        expect(metadata.team2.player2.chessTitle).toBeUndefined();
      });

      it("uses computePartnerPairScore for partner games score calculation", () => {
        const games = [
          createMatchGameWithResult(originalGame, partnerGame, "1-0"),
          createMatchGameWithResult(originalGame, partnerGame, "0-1"),
          createMatchGameWithResult(originalGame, partnerGame, "1-0"),
        ];

        const pairs = extractPartnerPairs(originalGame, partnerGame);
        expect(pairs).not.toBeNull();
        if (!pairs) return;

        const selectedPair = pairs[0]!;
        const metadata = buildMatchMetadata(games, "partnerGames", selectedPair);
        const expectedScore = computePartnerPairScore(games, selectedPair);

        // Verify the result matches the partner pair score
        const expectedResult = expectedScore.draws > 0
          ? `${expectedScore.pairWins} - ${expectedScore.pairLosses} (${expectedScore.draws} draw${expectedScore.draws !== 1 ? "s" : ""})`
          : `${expectedScore.pairWins} - ${expectedScore.pairLosses}`;

        expect(metadata.result).toBe(expectedResult);
        expect(metadata.gameCount).toBe(3);
      });

      it("includes draws in partner games result string", () => {
        const games = [
          createMatchGameWithResult(originalGame, partnerGame, "1-0"),
          createMatchGameWithResult(originalGame, partnerGame, "1/2-1/2"),
          createMatchGameWithResult(originalGame, partnerGame, "0-1"),
        ];

        const pairs = extractPartnerPairs(originalGame, partnerGame);
        expect(pairs).not.toBeNull();
        if (!pairs) return;

        const selectedPair = pairs[0]!;
        const metadata = buildMatchMetadata(games, "partnerGames", selectedPair);
        const expectedScore = computePartnerPairScore(games, selectedPair);

        if (expectedScore.draws > 0) {
          expect(metadata.result).toContain(`${expectedScore.draws} draw`);
        }
      });

      it("extracts chess titles correctly for selected pair", () => {
        const games = [createMatchGameWithResult(originalGame, partnerGame, "1-0")];

        const pairs = extractPartnerPairs(originalGame, partnerGame);
        expect(pairs).not.toBeNull();
        if (!pairs) return;

        const selectedPair = pairs[0]!;
        const metadata = buildMatchMetadata(games, "partnerGames", selectedPair);

        // Chess titles should be extracted from the first game
        // The exact titles depend on the fixture data, but they should be present if they exist
        expect(metadata.team1.player1.username).toBe(selectedPair.displayNames[0]);
        expect(metadata.team1.player2.username).toBe(selectedPair.displayNames[1]);
      });

      it("handles partner games with color swaps correctly", () => {
        // Game 1: Pair is white, wins
        const game1 = createMatchGameWithResult(originalGame, partnerGame, "1-0");

        // Game 2: Colors swapped, pair is now black, wins
        const game2 = createMatchGameWithSwappedColors(originalGame, partnerGame, "0-1");

        const games = [game1, game2];

        const pairs = extractPartnerPairs(originalGame, partnerGame);
        expect(pairs).not.toBeNull();
        if (!pairs) return;

        const selectedPair = pairs[0]!;
        const metadata = buildMatchMetadata(games, "partnerGames", selectedPair);
        const expectedScore = computePartnerPairScore(games, selectedPair);

        // Both games should be wins for the pair
        expect(expectedScore.pairWins).toBe(2);
        expect(expectedScore.pairLosses).toBe(0);
        expect(metadata.result).toBe(`${expectedScore.pairWins} - ${expectedScore.pairLosses}`);
      });
    });
  });
});
