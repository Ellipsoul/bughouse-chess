import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import type { ChessGame } from "../../../app/actions";
import type { MatchGame } from "../../../app/types/match";
import { computeMatchScore, computePartnerPairScore, establishReferenceTeams } from "../../../app/components/MatchNavigation";
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

describe("ShareGameModal - Match Score Calculation", () => {
  let originalGame: ChessGame;
  let partnerGame: ChessGame;

  beforeEach(() => {
    originalGame = loadFixture("160319845633.json");
    partnerGame = loadFixture("160319845635.json");
  });

  describe("Regular Match Score Display", () => {
    it("uses computeMatchScore for regular matches", () => {
      const games: MatchGame[] = [
        createMatchGameWithResult(originalGame, partnerGame, "1-0"),
        createMatchGameWithResult(originalGame, partnerGame, "0-1"),
        createMatchGameWithResult(originalGame, partnerGame, "1-0"),
      ];

      const score = computeMatchScore(games);
      const refTeams = establishReferenceTeams(games[0]!);

      // Verify score calculation
      expect(score.team1Wins).toBe(2);
      expect(score.team2Wins).toBe(1);
      expect(score.draws).toBe(0);

      // Verify reference teams are established correctly
      expect(refTeams.team1Display).toHaveLength(2);
      expect(refTeams.team2Display).toHaveLength(2);
    });

    it("correctly handles team color swaps in match score", () => {
      // Game 1: Team1 white, wins
      const game1 = createMatchGameWithResult(originalGame, partnerGame, "1-0");

      // Game 2: Colors swapped, Team1 black, wins
      const game2 = createMatchGameWithSwappedColors(originalGame, partnerGame, "0-1");

      // Game 3: Back to original colors, Team2 wins
      const game3 = createMatchGameWithResult(originalGame, partnerGame, "0-1");

      const games = [game1, game2, game3];
      const score = computeMatchScore(games);

      // Game 1: Team1 white, 1-0 -> Team1 wins
      // Game 2: Team1 black, 0-1 -> Team1 wins (black won)
      // Game 3: Team1 white, 0-1 -> Team2 wins (black won)
      expect(score.team1Wins).toBe(2);
      expect(score.team2Wins).toBe(1);
      expect(score.draws).toBe(0);
    });

    it("uses establishReferenceTeams to get consistent team names", () => {
      const games: MatchGame[] = [
        createMatchGameWithResult(originalGame, partnerGame, "1-0"),
        createMatchGameWithSwappedColors(originalGame, partnerGame, "0-1"),
      ];

      const refTeams = establishReferenceTeams(games[0]!);

      // Reference teams should be based on first game
      const firstGame = games[0]!;
      const expectedTeam1Player1 = firstGame.original.game.pgnHeaders.White;
      const expectedTeam1Player2 = firstGame.partner.game.pgnHeaders.Black;
      const expectedTeam2Player1 = firstGame.original.game.pgnHeaders.Black;
      const expectedTeam2Player2 = firstGame.partner.game.pgnHeaders.White;

      expect(refTeams.team1Display[0]).toBe(expectedTeam1Player1);
      expect(refTeams.team1Display[1]).toBe(expectedTeam1Player2);
      expect(refTeams.team2Display[0]).toBe(expectedTeam2Player1);
      expect(refTeams.team2Display[1]).toBe(expectedTeam2Player2);
    });
  });

  describe("Partner Games Score Display", () => {
    it("uses computePartnerPairScore for partner games", () => {
      const games: MatchGame[] = [
        createMatchGameWithResult(originalGame, partnerGame, "1-0"),
        createMatchGameWithResult(originalGame, partnerGame, "0-1"),
        createMatchGameWithResult(originalGame, partnerGame, "1-0"),
      ];

      const pairs = extractPartnerPairs(originalGame, partnerGame);
      expect(pairs).not.toBeNull();
      if (!pairs) return;

      const selectedPair = pairs[0]!; // First pair (Board A white + Board B black)
      const score = computePartnerPairScore(games, selectedPair);

      // Verify score calculation
      expect(score.pairWins).toBeGreaterThanOrEqual(0);
      expect(score.pairLosses).toBeGreaterThanOrEqual(0);
      expect(score.draws).toBe(0);
    });

    it("correctly calculates partner pair score when pair wins", () => {
      // Create games where the selected pair wins
      const games: MatchGame[] = [
        createMatchGameWithResult(originalGame, partnerGame, "1-0"), // Pair white, wins
        createMatchGameWithResult(originalGame, partnerGame, "1-0"), // Pair white, wins
      ];

      const pairs = extractPartnerPairs(originalGame, partnerGame);
      expect(pairs).not.toBeNull();
      if (!pairs) return;

      const selectedPair = pairs[0]!; // First pair (Board A white + Board B black)
      const score = computePartnerPairScore(games, selectedPair);

      // Both games: pair is white, result is 1-0, so pair wins
      expect(score.pairWins).toBe(2);
      expect(score.pairLosses).toBe(0);
      expect(score.draws).toBe(0);
    });

    it("correctly calculates partner pair score when pair loses", () => {
      // Create games where the selected pair loses
      const games: MatchGame[] = [
        createMatchGameWithResult(originalGame, partnerGame, "0-1"), // Pair white, loses
        createMatchGameWithResult(originalGame, partnerGame, "0-1"), // Pair white, loses
      ];

      const pairs = extractPartnerPairs(originalGame, partnerGame);
      expect(pairs).not.toBeNull();
      if (!pairs) return;

      const selectedPair = pairs[0]!; // First pair (Board A white + Board B black)
      const score = computePartnerPairScore(games, selectedPair);

      // Both games: pair is white, result is 0-1, so pair loses
      expect(score.pairWins).toBe(0);
      expect(score.pairLosses).toBe(2);
      expect(score.draws).toBe(0);
    });

    it("correctly calculates partner pair score when colors are swapped", () => {
      // Game 1: Pair is white, wins
      const game1 = createMatchGameWithResult(originalGame, partnerGame, "1-0");

      // Game 2: Colors swapped, pair is now black, wins
      const game2 = createMatchGameWithSwappedColors(originalGame, partnerGame, "0-1");

      const games = [game1, game2];

      const pairs = extractPartnerPairs(originalGame, partnerGame);
      expect(pairs).not.toBeNull();
      if (!pairs) return;

      const selectedPair = pairs[0]!; // First pair
      const score = computePartnerPairScore(games, selectedPair);

      // Game 1: Pair white, 1-0 -> pair wins
      // Game 2: Pair black, 0-1 -> pair wins (black won)
      expect(score.pairWins).toBe(2);
      expect(score.pairLosses).toBe(0);
      expect(score.draws).toBe(0);
    });

    it("handles draws in partner pair score", () => {
      const games: MatchGame[] = [
        createMatchGameWithResult(originalGame, partnerGame, "1/2-1/2"),
        createMatchGameWithResult(originalGame, partnerGame, "1/2-1/2"),
      ];

      const pairs = extractPartnerPairs(originalGame, partnerGame);
      expect(pairs).not.toBeNull();
      if (!pairs) return;

      const selectedPair = pairs[0]!;
      const score = computePartnerPairScore(games, selectedPair);

      expect(score.pairWins).toBe(0);
      expect(score.pairLosses).toBe(0);
      expect(score.draws).toBe(2);
    });
  });

  describe("Score Consistency", () => {
    it("match score calculation matches what is used in MatchNavigation", () => {
      const games: MatchGame[] = [
        createMatchGameWithResult(originalGame, partnerGame, "1-0"),
        createMatchGameWithResult(originalGame, partnerGame, "0-1"),
        createMatchGameWithResult(originalGame, partnerGame, "1-0"),
        createMatchGameWithResult(originalGame, partnerGame, "1/2-1/2"),
      ];

      const score = computeMatchScore(games);

      // Verify the score format matches what would be displayed
      const resultString = score.draws > 0
        ? `${score.team1Wins} - ${score.team2Wins} (${score.draws} draw${score.draws !== 1 ? "s" : ""})`
        : `${score.team1Wins} - ${score.team2Wins}`;

      expect(resultString).toContain("2 - 1");
      expect(resultString).toContain("1 draw");
    });

    it("partner pair score calculation matches what is used in MatchNavigation", () => {
      const games: MatchGame[] = [
        createMatchGameWithResult(originalGame, partnerGame, "1-0"),
        createMatchGameWithResult(originalGame, partnerGame, "0-1"),
        createMatchGameWithResult(originalGame, partnerGame, "1-0"),
      ];

      const pairs = extractPartnerPairs(originalGame, partnerGame);
      expect(pairs).not.toBeNull();
      if (!pairs) return;

      const selectedPair = pairs[0]!;
      const score = computePartnerPairScore(games, selectedPair);

      // Should show wins and losses (exact values depend on which pair is selected)
      expect(score.pairWins + score.pairLosses + score.draws).toBe(3);
    });
  });
});
