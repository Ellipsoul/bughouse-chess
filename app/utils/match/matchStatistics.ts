import { sha256 } from "js-sha256";
import type { MatchGame } from "@/app/types/match";
import type { PieceValuePreset } from "@/app/utils/analysis/captureMaterial";
import { computeGameMaterial } from "./matchMaterial";

/** Increment when replay/scoring semantics change. Board counts are player actions, including drops. */
export interface MatchStatistics {
  version: 2;
  fingerprint: string;
  gameCount: number;
  moves: { A: number; B: number };
  material: Record<PieceValuePreset, Record<string, number> | null>;
}
const pending = new Map<string, Promise<MatchStatistics>>();
const keys = new WeakMap<MatchGame[], string>();
const PREFIX = "bughouse:match-statistics:v2:";

/** Include replay inputs, not just IDs: incomplete or changed games must not reuse old totals. */
export function matchStatisticsKey(games: MatchGame[]): string {
  let key = keys.get(games);
  if (!key) {
    key = sha256(JSON.stringify(games.map(g => [g.gameId, g.partnerGameId,
      ...[g.original, g.partner].map(b => b ? [b.game.moveList, b.game.moveTimestamps, b.game.baseTime1, b.game.timeIncrement1, b.game.pgnHeaders] : null)])));
    keys.set(games, key);
  }
  return key;
}

/** Validate persisted data before letting it bypass replay. */
export function isMatchStatistics(value: unknown, fingerprint: string, count: number): value is MatchStatistics {
  const s = value as MatchStatistics | null;
  return !!s && s.version === 2 && s.fingerprint === fingerprint && s.gameCount === count
    && !!s.moves && [s.moves.A, s.moves.B].every(n => Number.isSafeInteger(n) && n >= 0)
    && !!s.material && ["bughouse", "standard"].every(p => {
      const totals = s.material[p as PieceValuePreset];
      return totals === null || (!!totals && typeof totals === "object" && !Array.isArray(totals)
        && Object.values(totals).every(n => typeof n === "number" && Number.isFinite(n)));
    });
}

/** Seed both memory and best-effort durable browser cache on Firestore reads. */
export function seedMatchStatistics(games: MatchGame[], stats: unknown): boolean {
  const key = matchStatisticsKey(games);
  if (!isMatchStatistics(stats, key, games.length)) return false;
  pending.set(key, Promise.resolve(stats));
  if (pending.size > 100) pending.delete(pending.keys().next().value!);
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PREFIX + key, JSON.stringify(stats));
      const stored = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
      for (const old of stored.slice(0, Math.max(0, stored.length - 100))) localStorage.removeItem(old);
    }
  } catch { /* Quota/privacy restrictions must not break viewing. */ }
  return true;
}

/** Coalesce consumers across dropdown mounts, navigation, and uploads. */
export function getMatchStatistics(games: MatchGame[]): Promise<MatchStatistics> {
  const key = matchStatisticsKey(games);
  const existing = pending.get(key);
  if (existing) return existing;
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(PREFIX + key) ?? "null");
    if (seedMatchStatistics(games, stored)) return pending.get(key)!;
  } catch { /* Server rendering or unavailable storage. */ }
  const work = calculate(games, key).then(stats => {
    seedMatchStatistics(games, stats);
    return stats;
  }).catch(error => { pending.delete(key); throw error; });
  pending.set(key, work);
  return work;
}

async function calculate(games: MatchGame[], fingerprint: string): Promise<MatchStatistics> {
  const stats: MatchStatistics = { version: 2, fingerprint, gameCount: games.length,
    moves: { A: 0, B: 0 }, material: { bughouse: {}, standard: {} } };
  for (const game of games) {
    // Yield between games; closing a dropdown does not cancel shared work.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    for (const [board, source] of [["A", game.original], ["B", game.partner]] as const) {
      const count = source?.game.moveList.length / 2;
      if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid move data");
      stats.moves[board] += count;
    }
    for (const preset of ["bughouse", "standard"] as const) {
      const values = computeGameMaterial(game, preset);
      const totals = stats.material[preset];
      if (!values) stats.material[preset] = null;
      else if (totals) for (const [name, value] of Object.entries(values)) {
        Object.defineProperty(totals, name, { value: (Object.hasOwn(totals, name) ? totals[name] : 0) + value, enumerable: true, configurable: true });
      }
    }
  }
  return stats;
}
