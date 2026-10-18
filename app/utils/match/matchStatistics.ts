import { sha256 } from "js-sha256";
import type { MatchGame } from "@/app/types/match";
import type { PieceValuePreset } from "@/app/utils/analysis/captureMaterial";
import { calculateMatchStatistics } from "./calculateMatchStatistics";

/** Increment when replay/scoring semantics change. Board counts are player actions, including drops. */
export interface MatchStatistics {
  version: 2;
  fingerprint: string;
  gameCount: number;
  moves: { A: number; B: number };
  material: Record<PieceValuePreset, Record<string, number> | null>;
}
const pending = new Map<string, Promise<MatchStatistics>>();
const repairs = new Map<string, Promise<MatchStatistics>>();
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
  if (restoreStoredStatistics(games, key)) return pending.get(key)!;
  const work = calculateInBackground(games, key).then(stats => {
    seedMatchStatistics(games, stats);
    return stats;
  }).catch(error => { pending.delete(key); throw error; });
  pending.set(key, work);
  return work;
}

function restoreStoredStatistics(games: MatchGame[], key: string): boolean {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(PREFIX + key) ?? "null");
    return seedMatchStatistics(games, stored);
  } catch { return false; /* Server rendering or unavailable storage. */ }
}

/** Start repair after the loader returns; dropdown consumers share this work. */
export function prepareMatchStatistics(games: MatchGame[], load: () => Promise<unknown>): void {
  const key = matchStatisticsKey(games);
  if (repairs.has(key)) return;
  if (!pending.has(key)) restoreStoredStatistics(games, key);
  const existing = pending.get(key);
  const work = new Promise<void>(resolve => setTimeout(resolve, 0))
    .then(load)
    .then(stats => {
      if (!isMatchStatistics(stats, key, games.length)) throw new Error("Invalid statistics response");
      return stats;
    })
    .catch(() => existing ?? calculateInBackground(games, key))
    .then(stats => { seedMatchStatistics(games, stats); return stats; });
  repairs.set(key, work);
  if (!existing) pending.set(key, work);
  void work.finally(() => repairs.delete(key)).catch(() => undefined);
  // A failed background job must neither reject the game load nor become unhandled.
  void work.catch(() => { if (pending.get(key) === work) pending.delete(key); });
}

/** Browser replay stays off the UI thread. Servers and unsupported browsers yield between games. */
function calculateInBackground(games: MatchGame[], key: string): Promise<MatchStatistics> {
  if (typeof window === "undefined" || typeof Worker === "undefined") return calculateMatchStatistics(games, key);
  return new Promise<MatchStatistics>((resolve, reject) => {
    const worker = new Worker(new URL("./matchStatistics.worker.ts", import.meta.url), { type: "module" });
    const finish = () => { clearTimeout(timeout); worker.terminate(); };
    const timeout = setTimeout(() => { finish(); reject(new Error("Statistics worker timed out")); }, 120_000);
    worker.onmessage = event => {
      finish();
      if (isMatchStatistics(event.data, key, games.length)) resolve(event.data);
      else reject(new Error("Statistics calculation failed"));
    };
    worker.onerror = () => { finish(); reject(new Error("Statistics worker failed")); };
    worker.onmessageerror = () => { finish(); reject(new Error("Invalid statistics worker response")); };
    try { worker.postMessage({ games, key }); }
    catch (error) { finish(); reject(error); }
  });
}
