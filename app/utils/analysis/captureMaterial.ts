import type { BughouseCaptureMaterialLedger } from "../../types/bughouse";
import type { BughouseBoardId, BughousePieceType, BughouseSide } from "../../types/analysis";

const BUGHOUSE_CAPTURE_VALUE_BY_PIECE: Record<BughousePieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 4,
  q: 7,
};

/**
 * Create a zeroed capture-material ledger.
 *
 * This is used as the initial value for both replay and analysis.
 */
export function createEmptyCaptureMaterialLedger(): BughouseCaptureMaterialLedger {
  return {
    A: { white: 0, black: 0 },
    B: { white: 0, black: 0 },
  };
}

/**
 * Return the bughouse material value for a captured piece.
 *
 * Bughouse scoring (as used by this UI feature):
 * - pawn: 1
 * - knight/bishop: 3
 * - rook: 5
 * - queen: 7
 */
export function getBughouseCaptureValueForPiece(piece: BughousePieceType): number {
  return BUGHOUSE_CAPTURE_VALUE_BY_PIECE[piece] ?? 0;
}

/**
 * Clone the capture-material ledger (small, fixed-shape deep clone).
 */
export function cloneCaptureMaterialLedger(
  ledger: BughouseCaptureMaterialLedger,
): BughouseCaptureMaterialLedger {
  return {
    A: { white: ledger.A.white, black: ledger.A.black },
    B: { white: ledger.B.white, black: ledger.B.black },
  };
}

/**
 * Apply a capture event to the capture-material ledger.
 *
 * Semantics:
 * - `capturerSide` gains points
 * - the opponent on the same board loses the same amount
 *
 * This function is immutable: it returns a new ledger object.
 */
export function applyCaptureToLedger(params: {
  ledger: BughouseCaptureMaterialLedger;
  board: BughouseBoardId;
  capturerSide: BughouseSide;
  capturedPiece: BughousePieceType;
}): BughouseCaptureMaterialLedger {
  const { ledger, board, capturerSide, capturedPiece } = params;
  const delta = getBughouseCaptureValueForPiece(capturedPiece);
  if (!delta) return ledger;

  const next = cloneCaptureMaterialLedger(ledger);
  const opponentSide: BughouseSide = capturerSide === "white" ? "black" : "white";
  next[board][capturerSide] += delta;
  next[board][opponentSide] -= delta;
  return next;
}

/**
 * Format a signed capture-material value for tiny HUD display.
 *
 * - Positive values are prefixed with `+`.
 * - Zero is rendered as `0` so the UI always has four stable counters.
 */
export function formatSignedCaptureMaterial(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `${value}`;
  return "0";
}
