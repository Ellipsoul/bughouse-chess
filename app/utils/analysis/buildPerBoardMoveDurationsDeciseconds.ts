import type { BughouseMove } from "../../types/bughouse";

/**
 * Build per-move durations (deciseconds) where each duration is measured **within the move's board**:
 * the elapsed time since the previous move on that same board.
 *
 * Why this exists:
 * - For live replay and clock simulation, we also model *global* time (time since last move on either
 *   board) because both boards' clocks run simultaneously.
 * - For the move list UI, the user-facing “move time” subscript is intended to show the time since
 *   the previous move on the *current* board only.
 *
 * Robustness policy:
 * - Missing/invalid timestamps are treated as "no additional time elapsed" (duration 0).
 * - If a board's timestamps regress (e.g. `tCur < tPrev`), we clamp to `tPrev` so durations never
 *   go negative.
 *
 * @param combinedMoves - Interleaved bughouse moves with timestamps expressed as elapsed time since game start.
 * @returns Per-move durations aligned to `combinedMoves` indices.
 */
export function buildPerBoardMoveDurationsDeciseconds(combinedMoves: BughouseMove[]): number[] {
  const lastTimestampByBoard: Record<"A" | "B", number> = { A: 0, B: 0 };

  return combinedMoves.map((move) => {
    const previous = lastTimestampByBoard[move.board] ?? 0;
    let current = Number.isFinite(move.timestamp) ? move.timestamp : previous;
    if (current < previous) current = previous;

    const duration = Math.max(0, current - previous);
    lastTimestampByBoard[move.board] = current;
    return duration;
  });
}


