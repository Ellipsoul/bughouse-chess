import type {
  BoardClocks,
  BughouseClocksSnapshotByBoard,
  ProcessedGameData,
} from "../../types/bughouse";

/**
 * Metadata about the derived bughouse clock timeline.
 *
 * This exists because chess.com's timestamp reporting (and our reconstruction of global time)
 * is not guaranteed to be perfect. When it isn't, we clamp/repair rather than crashing.
 */
export interface BughouseClockTimelineMeta {
  /**
   * Count of moves whose timestamp regressed (i.e., `tCur < tPrev`).
   * When this happens, we treat Δt as 0 and keep the previous timestamp as the anchor.
   */
  nonMonotonicMoveTimestamps: number;
  /**
   * Number of times a clock would have dropped below 0 and was clamped back to 0.
   */
  clampedToZeroEvents: number;
}

export interface BughouseClockTimelineResult {
  /**
   * `timeline[0]` is the game start; `timeline[i+1]` is the clock snapshot *after*
   * applying `processedGame.combinedMoves[i]`.
   */
  timeline: BughouseClocksSnapshotByBoard[];
  /**
   * Per-move “time spent” (deciseconds), aligned with `processedGame.combinedMoves` indices.
   *
   * This is derived from the same clock simulation as `timeline`:
   * it is exactly the amount by which the mover's clock decreased on their board for that move.
   */
  moveDurationsByGlobalIndex: number[];
  meta: BughouseClockTimelineMeta;
}

function cloneBoardClocks(clocks: BoardClocks): BoardClocks {
  return { white: clocks.white, black: clocks.black };
}

function cloneSnapshot(snapshot: BughouseClocksSnapshotByBoard): BughouseClocksSnapshotByBoard {
  return { A: cloneBoardClocks(snapshot.A), B: cloneBoardClocks(snapshot.B) };
}

function decrementRunningClock(
  clocks: BoardClocks,
  toMove: "white" | "black",
  deltaDeciseconds: number,
): { next: BoardClocks; clamped: boolean } {
  if (!(deltaDeciseconds > 0)) {
    return { next: clocks, clamped: false };
  }

  const next = cloneBoardClocks(clocks);
  const previous = next[toMove];
  const updated = previous - deltaDeciseconds;
  const clamped = updated < 0;
  next[toMove] = clamped ? 0 : updated;
  return { next, clamped };
}

/**
 * Build a global bughouse clock timeline where **two clocks run at once**:
 * the side-to-move on board A and the side-to-move on board B.
 *
 * We treat `processedGame.combinedMoves[i].timestamp` as an *elapsed* time (in deciseconds)
 * from game start to when that move occurred; therefore the real time between consecutive
 * global moves is \(Δt = t_i - t_{i-1}\).
 *
 * Important: This function intentionally does **not** apply increment after moves. This
 * matches the current plan for the revamp; we can add increment later as a single, localized
 * change after the move-count update.
 *
 * Worked example (deciseconds):
 * - initialTime = 3000 (5:00.0)
 * - Move 1 happens at t=5 on board A (white), so Δt=5.
 *   - A.white -= 5, B.white -= 5 (both boards start with white to move)
 * - If next move happens at t=12 on board B (white), Δt=7.
 *   - A.black -= 7 (since board A is now black to move after one A move)
 *   - B.white -= 7
 */
export function buildBughouseClockTimeline(
  processedGame: ProcessedGameData,
): BughouseClockTimelineResult {
  const initial = Math.max(0, Number.isFinite(processedGame.initialTime) ? processedGame.initialTime : 0);

  let snapshot: BughouseClocksSnapshotByBoard = {
    A: { white: initial, black: initial },
    B: { white: initial, black: initial },
  };

  let boardAMoveCount = 0;
  let boardBMoveCount = 0;

  const meta: BughouseClockTimelineMeta = {
    nonMonotonicMoveTimestamps: 0,
    clampedToZeroEvents: 0,
  };

  const timeline: BughouseClocksSnapshotByBoard[] = [cloneSnapshot(snapshot)];
  const moveDurationsByGlobalIndex: number[] = [];

  let lastGlobalTimestamp = 0;

  for (const move of processedGame.combinedMoves) {
    // Treat missing/invalid timestamps as "no additional time elapsed".
    let tCur = Number.isFinite(move.timestamp) ? move.timestamp : lastGlobalTimestamp;

    // Guard against regressions; we keep the last timestamp as the anchor so later deltas
    // remain stable.
    if (tCur < lastGlobalTimestamp) {
      meta.nonMonotonicMoveTimestamps += 1;
      tCur = lastGlobalTimestamp;
    }

    const delta = tCur - lastGlobalTimestamp;

    const toMoveA: "white" | "black" = boardAMoveCount % 2 === 0 ? "white" : "black";
    const toMoveB: "white" | "black" = boardBMoveCount % 2 === 0 ? "white" : "black";

    // Capture the mover's clock *before* decrement so we can compute move duration consistently
    // with the board clock display.
    const moverClockBefore = snapshot[move.board][move.side];

    const decA = decrementRunningClock(snapshot.A, toMoveA, delta);
    const decB = decrementRunningClock(snapshot.B, toMoveB, delta);

    snapshot = { A: decA.next, B: decB.next };
    if (decA.clamped) meta.clampedToZeroEvents += 1;
    if (decB.clamped) meta.clampedToZeroEvents += 1;

    const moverClockAfter = snapshot[move.board][move.side];
    moveDurationsByGlobalIndex.push(Math.max(0, moverClockBefore - moverClockAfter));

    // The move has now been made on its board, flipping the side-to-move for that board.
    if (move.board === "A") {
      boardAMoveCount += 1;
    } else {
      boardBMoveCount += 1;
    }

    timeline.push(cloneSnapshot(snapshot));
    lastGlobalTimestamp = tCur;
  }

  return { timeline, moveDurationsByGlobalIndex, meta };
}


