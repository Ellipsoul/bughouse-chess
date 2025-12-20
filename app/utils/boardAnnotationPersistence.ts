import type { BughouseBoardId } from "../types/analysis";
import {
  EMPTY_BOARD_ANNOTATIONS,
  type BoardAnnotations,
} from "./boardAnnotations";

/**
 * In-memory annotation persistence keyed by per-board FEN.
 *
 * This intentionally stores *two separate maps*, one for each bughouse board.
 */
export interface BoardAnnotationsByFen {
  A: Record<string, BoardAnnotations>;
  B: Record<string, BoardAnnotations>;
}

export function createEmptyBoardAnnotationsByFen(): BoardAnnotationsByFen {
  return { A: {}, B: {} };
}

/**
 * Convert a board FEN into a stable key.
 *
 * We use `"start"` as a sentinel for empty/undefined initial state.
 */
export function toFenKey(fen?: string): string {
  return fen && fen.trim() ? fen : "start";
}

/**
 * Read annotations for a given board+FEN. Returns a stable empty object if none exist.
 */
export function getAnnotationsForFen(
  store: BoardAnnotationsByFen,
  board: BughouseBoardId,
  fenKey: string,
): BoardAnnotations {
  return store[board][fenKey] ?? EMPTY_BOARD_ANNOTATIONS;
}

/**
 * Persist annotations for a given board+FEN immutably.
 */
export function setAnnotationsForFen(
  store: BoardAnnotationsByFen,
  board: BughouseBoardId,
  fenKey: string,
  next: BoardAnnotations,
): BoardAnnotationsByFen {
  return {
    ...store,
    [board]: {
      ...store[board],
      [fenKey]: next,
    },
  };
}


