/**
 * Capture-material scoring for bughouse analysis and replay.
 *
 * Tracks signed point totals per board and per player when pieces are captured.
 * Drops do not affect the ledger; only captures increment/decrement the running totals.
 */
import type { BughouseCaptureMaterialLedger } from "@/app/types/bughouse";
import type { BughouseBoardId, BughousePieceType, BughouseSide } from "@/app/types/analysis";

/** Named preset controlling how many points each captured piece type is worth. */
export type PieceValuePreset = "bughouse" | "standard";

/** Default scoring preset used when callers do not specify one explicitly. */
export const DEFAULT_PIECE_VALUE_PRESET: PieceValuePreset = "bughouse";

/**
 * Lookup table of piece values for each supported preset.
 * Bughouse values differ from standard chess (e.g. pawn = 1.5, queen = 7).
 */
export const PIECE_VALUE_PRESETS: Record<
  PieceValuePreset,
  Record<BughousePieceType, number>
> = {
  bughouse: {
    p: 1.5,
    n: 3,
    b: 3,
    r: 4,
    q: 7,
  },
  standard: {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
  },
};

/** Type guard for validating user/settings input before applying a piece-value preset. */
export function isPieceValuePreset(value: unknown): value is PieceValuePreset {
  return value === "bughouse" || value === "standard";
}

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
 * Return the configured material value for a captured piece.
 *
 * Bughouse scoring (as used by this UI feature):
 * - pawn: 1.5
 * - knight/bishop: 3
 * - rook: 4
 * - queen: 7
 */
export function getBughouseCaptureValueForPiece(
  piece: BughousePieceType,
  preset: PieceValuePreset = DEFAULT_PIECE_VALUE_PRESET,
): number {
  return PIECE_VALUE_PRESETS[preset][piece] ?? 0;
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
  pieceValuePreset?: PieceValuePreset;
}): BughouseCaptureMaterialLedger {
  const { ledger, board, capturerSide, capturedPiece, pieceValuePreset } = params;
  const delta = getBughouseCaptureValueForPiece(capturedPiece, pieceValuePreset);
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
