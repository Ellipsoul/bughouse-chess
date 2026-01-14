import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import type { ChessGame } from "../../../app/actions";
import type { MatchGame, PartnerPair } from "../../../app/types/match";
import type { PairKey } from "../../../app/utils/matchBoardOrientation";
import {
  computeBaseFlip,
  computeEffectiveFlip,
  getBottomPairKeyForGame,
} from "../../../app/utils/matchBoardOrientation";
import { getSharedMatchBaselineBottomPairKey } from "../../../app/utils/sharedGameOrientation";

type MatchIndexEntry = {
  gameId: string;
  partnerGameId: string;
  endTime: number;
};

type MatchIndex = {
  mode: "fullMatch";
  games: MatchIndexEntry[];
};

type PartnerSeriesIndex = {
  mode: "partnerPair";
  selectedPair: [string, string];
  games: MatchIndexEntry[];
};

function loadFixture(filename: string): ChessGame {
  return JSON.parse(
    readFileSync(join(process.cwd(), "tests", "fixtures", "chesscom", filename), "utf-8"),
  ) as ChessGame;
}

function loadIndex<T>(filename: string): T {
  return JSON.parse(
    readFileSync(join(process.cwd(), "tests", "fixtures", "chesscom", filename), "utf-8"),
  ) as T;
}

function loadMatchGames(entries: MatchIndexEntry[]): MatchGame[] {
  return entries.map((entry) => {
    const original = loadFixture(`${entry.gameId}.json`);
    const partner = loadFixture(`${entry.partnerGameId}.json`);

    return {
      gameId: entry.gameId,
      partnerGameId: entry.partnerGameId,
      original,
      partner,
      endTime: entry.endTime ?? original.game.endTime ?? 0,
    };
  });
}

describe("sharedGameOrientation", () => {
  it("keeps the partner-series selected pair on the bottom across shared games", () => {
    const index = loadIndex<PartnerSeriesIndex>("partner-series-index.json");
    const matchGames = loadMatchGames(index.games);
    const selectedPair: PartnerPair = {
      usernames: index.selectedPair,
      displayNames: index.selectedPair,
    };

    const baseline = getSharedMatchBaselineBottomPairKey({
      contentType: "partnerGames",
      matchGames,
      selectedPair,
    }) as PairKey;

    expect(baseline).toEqual(index.selectedPair);

    matchGames.forEach((game) => {
      const baseFlip = computeBaseFlip({
        baselineBottomPairKey: baseline,
        gameData: { original: game.original, partner: game.partner },
      });
      const effectiveFlip = computeEffectiveFlip({ baseFlip, userFlipPreference: false });
      const bottomPair = getBottomPairKeyForGame({
        gameData: { original: game.original, partner: game.partner },
        effectiveFlip,
      });

      expect(bottomPair).toEqual(baseline);
    });
  });

  it("keeps the full-match baseline pair on the bottom across shared games", () => {
    const index = loadIndex<MatchIndex>("match-index.json");
    const matchGames = loadMatchGames(index.games);

    const baseline = getSharedMatchBaselineBottomPairKey({
      contentType: "match",
      matchGames,
      selectedPair: null,
    }) as PairKey;

    const firstGame = matchGames[0]!;
    const expectedBaseline = getBottomPairKeyForGame({
      gameData: { original: firstGame.original, partner: firstGame.partner },
      effectiveFlip: false,
    });
    expect(baseline).toEqual(expectedBaseline);

    matchGames.forEach((game) => {
      const baseFlip = computeBaseFlip({
        baselineBottomPairKey: baseline,
        gameData: { original: game.original, partner: game.partner },
      });
      const effectiveFlip = computeEffectiveFlip({ baseFlip, userFlipPreference: false });
      const bottomPair = getBottomPairKeyForGame({
        gameData: { original: game.original, partner: game.partner },
        effectiveFlip,
      });

      expect(bottomPair).toEqual(baseline);
    });
  });
});
