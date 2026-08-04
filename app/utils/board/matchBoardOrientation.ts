/**
 * Board-orientation helpers for multi-game bughouse match viewing.
 *
 * Keeps a baseline partner pair anchored on the bottom of the UI across games in a
 * match, regardless of which board chess.com labels as "original" vs "partner".
 */
import type { ChessGame } from "@/app/actions";

/**
 * A normalized, order-insensitive pair key used to identify a bughouse partner pair.
 *
 * We store both usernames lowercased and sorted so comparisons are stable even if callers
 * provide names in different casing/order.
 */
export type PairKey = readonly [string, string];

/** Minimal game payload shape required for pair-key extraction. */
type MinimalBughouseGameData = {
  original: ChessGame;
  partner: ChessGame | null;
};

/**
 * Normalize two usernames into a sorted, lowercased pair key for stable comparison.
 * Order of arguments does not affect the result.
 */
function normalizePairKey(a: string, b: string): PairKey {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return (x <= y ? [x, y] : [y, x]) as PairKey;
}

/** Safely read a PGN header value, returning null when missing or blank. */
function safeHeader(game: ChessGame | null | undefined, key: "White" | "Black"): string | null {
  const value = game?.game?.pgnHeaders?.[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Extract the partner pair that corresponds to:
 * - Board A White player + Board B Black player
 *
 * In the current UI (`BughouseAnalysis`), this is the bottom-side pair when `boardsFlipped=false`.
 *
 * @returns A normalized `PairKey`, or `null` if data is missing.
 */
export function extractAWhiteBBlackPairKey(gameData: MinimalBughouseGameData): PairKey | null {
  const aWhite = safeHeader(gameData.original, "White");
  const bBlack = safeHeader(gameData.partner, "Black");
  if (!aWhite || !bBlack) return null;
  return normalizePairKey(aWhite, bBlack);
}

/**
 * Extract the partner pair that corresponds to:
 * - Board A Black player + Board B White player
 *
 * In the current UI (`BughouseAnalysis`), this is the bottom-side pair when `boardsFlipped=true`.
 *
 * @returns A normalized `PairKey`, or `null` if data is missing.
 */
export function extractABlackBWhitePairKey(gameData: MinimalBughouseGameData): PairKey | null {
  const aBlack = safeHeader(gameData.original, "Black");
  const bWhite = safeHeader(gameData.partner, "White");
  if (!aBlack || !bWhite) return null;
  return normalizePairKey(aBlack, bWhite);
}

/** Compare two normalized pair keys for equality. */
function pairKeysEqual(a: PairKey, b: PairKey): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/**
 * Computes whether a specific game should be flipped to keep a baseline partner pair on the bottom.
 *
 * Definitions (matching the existing `BughouseAnalysis` UI):
 * - When `boardsFlipped=false`, the bottom-side partner pair is (A White + B Black).
 * - When `boardsFlipped=true`, the bottom-side partner pair is (A Black + B White).
 *
 * Therefore:
 * - If the baseline pair equals (A White + B Black), `baseFlip=false` keeps it on bottom.
 * - If the baseline pair equals (A Black + B White), `baseFlip=true` keeps it on bottom.
 *
 * If the baseline pair cannot be found in this game (unexpected), we default to `false`
 * so behavior stays stable and conservative.
 */
export function computeBaseFlip(params: {
  baselineBottomPairKey: PairKey | null;
  gameData: MinimalBughouseGameData;
}): boolean {
  const { baselineBottomPairKey, gameData } = params;
  if (!baselineBottomPairKey) return false;

  const aWhiteBBlack = extractAWhiteBBlackPairKey(gameData);
  const aBlackBWhite = extractABlackBWhitePairKey(gameData);
  if (!aWhiteBBlack || !aBlackBWhite) return false;

  if (pairKeysEqual(baselineBottomPairKey, aWhiteBBlack)) return false;
  if (pairKeysEqual(baselineBottomPairKey, aBlackBWhite)) return true;

  return false;
}

/**
 * Combine the per-game base flip (to keep the baseline on bottom) with a user preference.
 *
 * - `userFlipPreference=false`: keep baseline on the bottom.
 * - `userFlipPreference=true`: invert the baseline (baseline ends up on top).
 */
export function computeEffectiveFlip(params: {
  baseFlip: boolean;
  userFlipPreference: boolean;
}): boolean {
  const { baseFlip, userFlipPreference } = params;
  return baseFlip !== userFlipPreference;
}

/**
 * Returns the normalized partner pair that will appear on the bottom side for a given game
 * under a given `effectiveFlip`.
 *
 * This is primarily intended for unit tests and validation.
 */
export function getBottomPairKeyForGame(params: {
  gameData: MinimalBughouseGameData;
  effectiveFlip: boolean;
}): PairKey | null {
  const { gameData, effectiveFlip } = params;
  return effectiveFlip
    ? extractABlackBWhitePairKey(gameData)
    : extractAWhiteBBlackPairKey(gameData);
}
