import type { BughouseClocksSnapshotByBoard } from "../types/bughouse";

/**
 * Bughouse teams are fixed by board-color pairing:
 * - Team1: A White + B Black
 * - Team2: A Black + B White
 *
 * This matches the existing UI/player mapping used across the app.
 */
export type BughouseTeam = "AWhite_BBlack" | "ABlack_BWhite";

/**
 * Compute the signed team time difference (deciseconds).
 *
 * Positive => Team AWhite_BBlack is leading.
 * Negative => Team ABlack_BWhite is leading.
 */
export function getTeamTimeDiffDeciseconds(
  snapshot: BughouseClocksSnapshotByBoard,
): number {
  const team1 = snapshot.A.white + snapshot.B.black;
  const team2 = snapshot.A.black + snapshot.B.white;
  return team1 - team2;
}

function getAdvantageTier(absDiffDeciseconds: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!(absDiffDeciseconds > 0)) return 0;

  // Exponential tiers in seconds: <1, <2, <4, <8, <16, >=16 (cap)
  if (absDiffDeciseconds < 10) return 1;
  if (absDiffDeciseconds < 20) return 2;
  if (absDiffDeciseconds < 40) return 3;
  if (absDiffDeciseconds < 80) return 4;
  return 5;
}

/**
 * Tailwind classes for tinting a clock by team advantage.
 *
 * Returns `null` when clocks are exactly even (tier 0), so callers can fall back
 * to their default neutral styling.
 */
export function getClockTintClasses(options: {
  diffDeciseconds: number;
  team: BughouseTeam;
  isFrozen?: boolean;
}): string | null {
  const tier = getAdvantageTier(Math.abs(options.diffDeciseconds));
  if (tier === 0) return null;

  const leadingTeam: BughouseTeam =
    options.diffDeciseconds > 0 ? "AWhite_BBlack" : "ABlack_BWhite";
  const isLeading = options.team === leadingTeam;
  const isFrozen = Boolean(options.isFrozen);

  // We keep this conservative (built-in Tailwind colors + basic drop-shadows),
  // so it stays robust across Tailwind upgrades/config.
  const greenTextByTier = [
    "",
    isFrozen ? "text-emerald-200/45" : "text-emerald-200/60",
    isFrozen ? "text-emerald-200/60" : "text-emerald-200/75",
    isFrozen ? "text-emerald-200/75" : "text-emerald-300/90",
    isFrozen ? "text-emerald-300/75" : "text-emerald-400/90",
    isFrozen ? "text-emerald-400/75" : "text-emerald-400",
  ] as const;

  const redTextByTier = [
    "",
    isFrozen ? "text-rose-200/45" : "text-rose-200/60",
    isFrozen ? "text-rose-200/60" : "text-rose-200/75",
    isFrozen ? "text-rose-200/75" : "text-rose-300/90",
    isFrozen ? "text-rose-300/75" : "text-rose-400/90",
    isFrozen ? "text-rose-400/75" : "text-rose-400",
  ] as const;

  const glowByTier = [
    "",
    "",
    "drop-shadow-sm",
    "drop-shadow-sm",
    "drop-shadow",
    "drop-shadow",
  ] as const;

  const text = isLeading ? greenTextByTier[tier] : redTextByTier[tier];
  const glow = glowByTier[tier];

  return [text, glow].filter(Boolean).join(" ");
}


