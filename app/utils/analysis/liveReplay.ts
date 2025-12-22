import type { AnalysisTree } from "../../types/analysis";
import type { BughouseClocksSnapshotByBoard, BughouseMove } from "../../types/bughouse";

export interface BughouseBoardMoveCounts {
  A: number;
  B: number;
}

function cloneSnapshot(snapshot: BughouseClocksSnapshotByBoard): BughouseClocksSnapshotByBoard {
  return {
    A: { white: snapshot.A.white, black: snapshot.A.black },
    B: { white: snapshot.B.white, black: snapshot.B.black },
  };
}

function clampNonNegativeFiniteNumber(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

/**
 * Build a monotonic timestamp array (deciseconds) from chess.com's per-move timestamps.
 *
 * chess.com data can sometimes regress (e.g. later move reports a smaller elapsed time).
 * For replay, we must preserve **monotonic time** so elapsed-time comparisons stay stable.
 *
 * We follow the same policy as `buildBughouseClockTimeline`:
 * if a timestamp regresses, treat it as equal to the previous timestamp (Δt = 0).
 */
export function buildMonotonicMoveTimestampsDeciseconds(combinedMoves: BughouseMove[]): number[] {
  const out: number[] = [];
  let last = 0;
  for (const mv of combinedMoves) {
    const raw = Number.isFinite(mv.timestamp) ? mv.timestamp : last;
    const next = raw < last ? last : raw;
    out.push(next);
    last = next;
  }
  return out;
}

/**
 * Build per-board move counts after each global ply.
 *
 * `counts[p]` describes the number of moves that have been applied on board A/B after
 * applying exactly `p` global moves (i.e. `p` elements of `combinedMoves`).
 *
 * This is used to determine the side-to-move on each board at an arbitrary time slice.
 */
export function buildBughouseBoardMoveCountsByGlobalPly(
  combinedMoves: BughouseMove[],
): BughouseBoardMoveCounts[] {
  const counts: BughouseBoardMoveCounts[] = [{ A: 0, B: 0 }];
  let a = 0;
  let b = 0;
  for (const mv of combinedMoves) {
    if (mv.board === "A") a += 1;
    else b += 1;
    counts.push({ A: a, B: b });
  }
  return counts;
}

function findLastMoveIndexAtOrBeforeElapsed(params: {
  monotonicMoveTimestamps: number[];
  elapsedDeciseconds: number;
}): number {
  const { monotonicMoveTimestamps, elapsedDeciseconds } = params;
  const n = monotonicMoveTimestamps.length;
  if (n === 0) return -1;

  let lo = 0;
  let hi = n - 1;
  let ans = -1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const t = monotonicMoveTimestamps[mid] ?? 0;
    if (t <= elapsedDeciseconds) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return ans;
}

/**
 * Compute a *continuous* bughouse clock snapshot at an arbitrary elapsed time.
 *
 * Inputs are intentionally “precomputed primitives” so callers can memoize expensive work:
 * - `timeline[0]` is the start snapshot; `timeline[i+1]` is after move `i`.
 * - `monotonicMoveTimestamps[i]` is the effective (clamped) elapsed time when move `i` occurred.
 * - `boardMoveCountsByGlobalPly[p]` is the per-board move count after `p` global moves.
 *
 * This function applies the remaining Δt between the last move ≤ elapsed and `elapsed`
 * to both boards' currently-running clocks (side-to-move on each board).
 *
 * @example
 * ```ts
 * const t = buildBughouseClockTimeline(processedGame).timeline
 * const ts = buildMonotonicMoveTimestampsDeciseconds(processedGame.combinedMoves)
 * const counts = buildBughouseBoardMoveCountsByGlobalPly(processedGame.combinedMoves)
 * const snapshot = getBughouseClockSnapshotAtElapsedDeciseconds({
 *   timeline: t,
 *   monotonicMoveTimestamps: ts,
 *   boardMoveCountsByGlobalPly: counts,
 *   elapsedDeciseconds: 1234,
 * })
 * ```
 */
export function getBughouseClockSnapshotAtElapsedDeciseconds(params: {
  timeline: BughouseClocksSnapshotByBoard[];
  monotonicMoveTimestamps: number[];
  boardMoveCountsByGlobalPly: BughouseBoardMoveCounts[];
  elapsedDeciseconds: number;
}): BughouseClocksSnapshotByBoard {
  const { timeline, monotonicMoveTimestamps, boardMoveCountsByGlobalPly } = params;
  const elapsed = Math.floor(clampNonNegativeFiniteNumber(params.elapsedDeciseconds));

  if (!timeline.length) {
    return { A: { white: 0, black: 0 }, B: { white: 0, black: 0 } };
  }

  const lastMoveIndex = findLastMoveIndexAtOrBeforeElapsed({
    monotonicMoveTimestamps,
    elapsedDeciseconds: elapsed,
  });

  const globalPly = lastMoveIndex + 1; // 0 at start position
  const baseTimelineIndex = Math.min(Math.max(globalPly, 0), timeline.length - 1);
  const base = cloneSnapshot(timeline[baseTimelineIndex]!);

  const lastTimestamp = lastMoveIndex >= 0 ? monotonicMoveTimestamps[lastMoveIndex] ?? 0 : 0;
  const delta = Math.max(0, elapsed - lastTimestamp);
  if (!(delta > 0)) {
    return base;
  }

  const counts =
    boardMoveCountsByGlobalPly[Math.min(Math.max(globalPly, 0), boardMoveCountsByGlobalPly.length - 1)] ??
    boardMoveCountsByGlobalPly[0] ??
    { A: 0, B: 0 };

  const toMoveA: "white" | "black" = counts.A % 2 === 0 ? "white" : "black";
  const toMoveB: "white" | "black" = counts.B % 2 === 0 ? "white" : "black";

  base.A[toMoveA] = Math.max(0, base.A[toMoveA] - delta);
  base.B[toMoveB] = Math.max(0, base.B[toMoveB] - delta);
  return base;
}

/**
 * Returns true iff the current analysis tree's **mainline** exactly matches the loaded game's
 * combined mainline moves.
 *
 * This is the eligibility gate for live replay: if the user truncates, extends, or overwrites
 * the loaded line (e.g. promotes a variation to mainline), we must disable live replay because
 * we no longer have authoritative timestamps for the resulting line.
 *
 * Important: `combinedMoves` should be SAN-normalized to match `incomingMove.san` on nodes.
 */
export function isPristineLoadedMainline(params: {
  tree: AnalysisTree;
  combinedMoves: BughouseMove[] | undefined;
}): boolean {
  const { tree, combinedMoves } = params;
  if (!combinedMoves || combinedMoves.length === 0) return false;

  let nodeId: string = tree.rootId;

  for (let i = 0; i < combinedMoves.length; i += 1) {
    const expected = combinedMoves[i]!;
    const parent = tree.nodesById[nodeId];
    if (!parent?.mainChildId) return false;

    const childId = parent.mainChildId;
    const child = tree.nodesById[childId];
    const mv = child?.incomingMove;
    if (!child || !mv) return false;

    if (mv.board !== expected.board) return false;
    if (mv.side !== expected.side) return false;
    if (mv.san !== expected.move) return false;

    nodeId = childId;
  }

  // If the analysis mainline continues beyond the loaded game, it isn't pristine.
  const endNode = tree.nodesById[nodeId];
  if (endNode?.mainChildId) return false;

  return true;
}


