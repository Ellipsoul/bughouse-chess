/**
 * FEN-keyed persistence for user-drawn board annotations (circles and arrows).
 *
 * Annotations are stored separately per logical board (A/B) so swapping board order
 * in the UI does not collide keys.
 */
import type { BughouseBoardId } from "@/app/types/analysis";
import {
  EMPTY_BOARD_ANNOTATIONS,
  type BoardAnnotations,
} from "@/app/utils/board/boardAnnotations";

/**
 * In-memory annotation persistence keyed by per-board FEN.
 *
 * This intentionally stores *two separate maps*, one for each bughouse board.
 */
export interface BoardAnnotationsByFen {
  /** Annotation map for logical board A, keyed by FEN string. */
  A: Record<string, BoardAnnotations>;
  /** Annotation map for logical board B, keyed by FEN string. */
  B: Record<string, BoardAnnotations>;
}

/** Create an empty annotation store with no entries for either board. */
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
