import type { Square } from "chess.js";

/**
 * Key representing a directed arrow from one square to another.
 *
 * We intentionally keep arrows directed (e2->e4 is different from e4->e2)
 * because that matches standard chess UIs and is useful for analysis.
 */
export type ArrowKey = `${Square}->${Square}`;

/**
 * Persisted user drawings for a single board position (circles + arrows).
 */
export interface BoardAnnotations {
  circles: Square[];
  arrows: ArrowKey[];
}

export const EMPTY_BOARD_ANNOTATIONS: BoardAnnotations = Object.freeze({
  circles: [],
  arrows: [],
});

/**
 * Returns true iff the value is a valid algebraic chessboard square like "e4".
 */
export function isSquare(value: string): value is Square {
  return /^[a-h][1-8]$/.test(value);
}

/**
 * Build a canonical arrow key for a directed arrow.
 */
export function buildArrowKey(from: Square, to: Square): ArrowKey {
  return `${from}->${to}` as ArrowKey;
}

/**
 * Toggle a square in a list, returning a new list.
 *
 * This is implemented as a list (not a Set) so it is easy to store in React state
 * and to preserve deterministic ordering (useful for stable rendering/testing).
 */
export function toggleSquareInList(list: readonly Square[], square: Square): Square[] {
  const idx = list.indexOf(square);
  if (idx === -1) return [...list, square];
  return [...list.slice(0, idx), ...list.slice(idx + 1)];
}

/**
 * Toggle a directed arrow in a list, returning a new list.
 */
export function toggleArrowInList(
  list: readonly ArrowKey[],
  from: Square,
  to: Square,
): ArrowKey[] {
  const key = buildArrowKey(from, to);
  const idx = list.indexOf(key);
  if (idx === -1) return [...list, key];
  return [...list.slice(0, idx), ...list.slice(idx + 1)];
}


