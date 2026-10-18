import type { BughouseMove } from "@/app/types/bughouse";
import type { BughouseBoardId, BughousePositionSnapshot } from "@/app/types/analysis";
import { createInitialPositionSnapshot, validateAndApplyMoveFromNotation, type ValidateAndApplyResult } from "./applyMove";

/**
 * Pre-process combined moves to recover a legal cross-board ordering.
 *
 * Chess.com's clock-derived global timestamps are not a causal event log. Besides
 * genuinely simultaneous moves, a conditional premove can be timestamped when it
 * was queued even though it executes only after a later partner capture. This can
 * create validation failures:
 *
 * 1. **Checkmate case**: Checkmate on board A while board B has a move in-flight.
 *    The non-checkmating move should come before the checkmate.
 *
 * 2. **Piece availability case**: A drop on board A uses a piece that was just
 *    captured on board B. If ordered wrong, the piece isn't available yet.
 *
 * This function splits the timeline back into its two authoritative per-board
 * move sequences, then merges them again. It normally takes the earlier timestamp,
 * but when that move is not yet legal it advances the other board until the
 * dependency is satisfied. Per-board move order is never changed.
 *
 * @remarks
 * For equal timestamps we also test both two-move orders. This preserves the
 * existing checkmate recovery: if the preferred move ends the match before the
 * other board's simultaneous move can be applied, the other move goes first.
 */
export function reorderSimultaneousCheckmateMove(combinedMoves: BughouseMove[]): BughouseMove[] {
  if (combinedMoves.length < 2) return combinedMoves;

  type IndexedMove = { move: BughouseMove; originalIndex: number };
  const movesByBoard: Record<BughouseBoardId, IndexedMove[]> = { A: [], B: [] };
  combinedMoves.forEach((move, originalIndex) => {
    movesByBoard[move.board].push({ move, originalIndex });
  });

  const nextIndex: Record<BughouseBoardId, number> = { A: 0, B: 0 };
  const reordered: BughouseMove[] = [];
  let position = createInitialPositionSnapshot();

  const apply = (candidate: IndexedMove, from: BughousePositionSnapshot) =>
    validateAndApplyMoveFromNotation(from, {
      board: candidate.move.board,
      side: candidate.move.side,
      move: candidate.move.move,
    });

  const commit = (candidate: IndexedMove, applied: ValidateAndApplyResult) => {
    if (applied.type !== "ok") return;
    reordered.push(candidate.move);
    nextIndex[candidate.move.board] += 1;
    position = applied.next;
  };

  while (reordered.length < combinedMoves.length) {
    const nextA = movesByBoard.A[nextIndex.A];
    const nextB = movesByBoard.B[nextIndex.B];
    if (!nextA && !nextB) return combinedMoves;

    let preferred: IndexedMove;
    let alternate: IndexedMove | undefined;
    if (!nextA) {
      preferred = nextB;
    } else if (!nextB) {
      preferred = nextA;
    } else if (
      nextA.move.timestamp < nextB.move.timestamp ||
      (nextA.move.timestamp === nextB.move.timestamp && nextA.originalIndex < nextB.originalIndex)
    ) {
      preferred = nextA;
      alternate = nextB;
    } else {
      preferred = nextB;
      alternate = nextA;
    }

    const preferredResult = apply(preferred, position);
    if (preferredResult.type === "ok") {
      if (alternate && alternate.move.timestamp === preferred.move.timestamp) {
        const alternateResult = apply(alternate, position);
        if (alternateResult.type === "ok") {
          const preferredThenAlternate = apply(alternate, preferredResult.next);
          const alternateThenPreferred = apply(preferred, alternateResult.next);
          if (preferredThenAlternate.type !== "ok" && alternateThenPreferred.type === "ok") {
            commit(alternate, alternateResult);
            continue;
          }
        }
      }

      commit(preferred, preferredResult);
      continue;
    }

    if (alternate) {
      const alternateResult = apply(alternate, position);
      if (alternateResult.type === "ok") {
        commit(alternate, alternateResult);
        continue;
      }
    }

    // The source is malformed (or has a dependency this two-board merge cannot
    // satisfy). Preserve the provider order so loadGameMainline reports the
    // original, most useful failure rather than returning a partially reordered line.
    return combinedMoves;
  }

  return reordered;
}
