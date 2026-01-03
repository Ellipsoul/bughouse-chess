import { describe, expect, it } from "vitest";
import type { ChessGame } from "../../../app/actions";
import type { PairKey } from "../../../app/utils/matchBoardOrientation";
import {
  computeBaseFlip,
  computeEffectiveFlip,
  getBottomPairKeyForGame,
} from "../../../app/utils/matchBoardOrientation";

function makeChessGame(headers: { White: string; Black: string }): ChessGame {
  // We only need the PGN headers for these tests. Everything else is irrelevant to orientation.
  return {
    game: {
      pgnHeaders: {
        White: headers.White,
        Black: headers.Black,
      },
    },
  } as unknown as ChessGame;
}

function makeGameData(params: {
  aWhite: string;
  aBlack: string;
  bWhite: string;
  bBlack: string;
}): { original: ChessGame; partner: ChessGame } {
  return {
    original: makeChessGame({ White: params.aWhite, Black: params.aBlack }),
    partner: makeChessGame({ White: params.bWhite, Black: params.bBlack }),
  };
}

describe("matchBoardOrientation", () => {
  it("keeps baseline bottom pair stable across games in full-match mode (color swap)", () => {
    const game1 = makeGameData({
      aWhite: "Alice",
      aBlack: "Bob",
      bWhite: "Carol",
      bBlack: "Dave",
    });
    // With flip=false, bottom pair is (A White + B Black) => Alice + Dave.
    const baselineBottomPairKey = getBottomPairKeyForGame({
      gameData: { original: game1.original, partner: game1.partner },
      effectiveFlip: false,
    }) as PairKey;
    expect(baselineBottomPairKey).toEqual(["alice", "dave"]);

    // Game 2 swaps colors for the same teams.
    const game2 = makeGameData({
      aWhite: "Bob",
      aBlack: "Alice",
      bWhite: "Dave",
      bBlack: "Carol",
    });

    const baseFlip2 = computeBaseFlip({
      baselineBottomPairKey,
      gameData: { original: game2.original, partner: game2.partner },
    });
    expect(baseFlip2).toBe(true);

    const effectiveFlip2 = computeEffectiveFlip({ baseFlip: baseFlip2, userFlipPreference: false });
    const bottom2 = getBottomPairKeyForGame({
      gameData: { original: game2.original, partner: game2.partner },
      effectiveFlip: effectiveFlip2,
    });
    expect(bottom2).toEqual(baselineBottomPairKey);
  });

  it("keeps selected partner pair on bottom across games in partner-pair mode", () => {
    const selectedPair: PairKey = ["alice", "dave"];

    const game1 = makeGameData({
      aWhite: "Alice",
      aBlack: "Bob",
      bWhite: "Carol",
      bBlack: "Dave",
    });
    const baseFlip1 = computeBaseFlip({
      baselineBottomPairKey: selectedPair,
      gameData: { original: game1.original, partner: game1.partner },
    });
    const effectiveFlip1 = computeEffectiveFlip({ baseFlip: baseFlip1, userFlipPreference: false });
    const bottom1 = getBottomPairKeyForGame({
      gameData: { original: game1.original, partner: game1.partner },
      effectiveFlip: effectiveFlip1,
    });
    expect(bottom1).toEqual(selectedPair);

    const game2 = makeGameData({
      aWhite: "Bob",
      aBlack: "Alice",
      bWhite: "Dave",
      bBlack: "Carol",
    });
    const baseFlip2 = computeBaseFlip({
      baselineBottomPairKey: selectedPair,
      gameData: { original: game2.original, partner: game2.partner },
    });
    const effectiveFlip2 = computeEffectiveFlip({ baseFlip: baseFlip2, userFlipPreference: false });
    const bottom2 = getBottomPairKeyForGame({
      gameData: { original: game2.original, partner: game2.partner },
      effectiveFlip: effectiveFlip2,
    });
    expect(bottom2).toEqual(selectedPair);
  });

  it("user flip preference inverts baseline consistently across all games", () => {
    const baselineBottomPairKey: PairKey = ["alice", "dave"];

    const game1 = makeGameData({
      aWhite: "Alice",
      aBlack: "Bob",
      bWhite: "Carol",
      bBlack: "Dave",
    });
    const game2 = makeGameData({
      aWhite: "Bob",
      aBlack: "Alice",
      bWhite: "Dave",
      bBlack: "Carol",
    });

    const baseFlip1 = computeBaseFlip({
      baselineBottomPairKey,
      gameData: { original: game1.original, partner: game1.partner },
    });
    const baseFlip2 = computeBaseFlip({
      baselineBottomPairKey,
      gameData: { original: game2.original, partner: game2.partner },
    });

    // Invert the baseline: baseline should end up on top, so the bottom pair should be the other team.
    const userFlipPreference = true;

    const bottom1 = getBottomPairKeyForGame({
      gameData: { original: game1.original, partner: game1.partner },
      effectiveFlip: computeEffectiveFlip({ baseFlip: baseFlip1, userFlipPreference }),
    });
    const bottom2 = getBottomPairKeyForGame({
      gameData: { original: game2.original, partner: game2.partner },
      effectiveFlip: computeEffectiveFlip({ baseFlip: baseFlip2, userFlipPreference }),
    });

    expect(bottom1).toEqual(["bob", "carol"]);
    expect(bottom2).toEqual(["bob", "carol"]);
  });

  it("is defensive when partner game is missing", () => {
    const baselineBottomPairKey: PairKey = ["alice", "dave"];
    const original = makeChessGame({ White: "Alice", Black: "Bob" });

    const baseFlip = computeBaseFlip({
      baselineBottomPairKey,
      gameData: { original, partner: null },
    });
    expect(baseFlip).toBe(false);

    const bottom = getBottomPairKeyForGame({
      gameData: { original, partner: null },
      effectiveFlip: false,
    });
    expect(bottom).toBeNull();
  });
});
