import type { MatchGame, PartnerPair } from "../types/match";
import type { SharedContentType } from "../types/sharedGame";
import type { PairKey } from "./matchBoardOrientation";
import { getBottomPairKeyForGame } from "./matchBoardOrientation";

/**
 * Determine the baseline partner pair that should remain on the bottom when a shared
 * match/series is loaded.
 *
 * - For partner-series shares, we prefer the stored selected pair (if available).
 * - Otherwise, we anchor to the bottom pair of the first game with flip=false.
 *
 * @example
 * ```ts
 * const baseline = getSharedMatchBaselineBottomPairKey({
 *   contentType: "match",
 *   matchGames,
 *   selectedPair: null,
 * });
 * ```
 */
export function getSharedMatchBaselineBottomPairKey(params: {
  contentType: SharedContentType;
  matchGames: MatchGame[];
  selectedPair: PartnerPair | null;
}): PairKey | null {
  const { contentType, matchGames, selectedPair } = params;

  if (contentType === "partnerGames" && selectedPair) {
    return selectedPair.usernames;
  }

  if (contentType === "game") return null;

  const firstGame = matchGames[0];
  if (!firstGame) return null;

  return getBottomPairKeyForGame({
    gameData: { original: firstGame.original, partner: firstGame.partner },
    effectiveFlip: false,
  });
}
