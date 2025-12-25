import { Chess, type Color, type Move, type PieceSymbol, type Square } from "chess.js";
import type { PieceReserves } from "../../types/bughouse";
import type {
  AttemptedBughouseHalfMove,
  BughouseBoardId,
  BughouseHalfMove,
  BughousePieceType,
  BughousePositionSnapshot,
  BughousePromotionPiece,
  BughouseSide,
} from "../../types/analysis";
import { validateAndConvertMove } from "../moveConverter";
import { getBughouseCheckSuffix, isBughouseCheckmate, normalizeSanSuffixForBughouse } from "../bughouseCheckmate";

type ValidationOk = { type: "ok"; move: BughouseHalfMove; next: BughousePositionSnapshot };
type ValidationError = { type: "error"; message: string };
type ValidationNeedsPromotion = {
  type: "needs_promotion";
  message: string;
  allowed: BughousePromotionPiece[];
};

export type ValidateAndApplyResult = ValidationOk | ValidationError | ValidationNeedsPromotion;

/**
 * Bughouse ends immediately when either board is checkmated.
 *
 * We currently treat that as a hard stop for analysis move entry: once checkmate
 * exists on either board, no further moves/drops can be added to the tree from
 * that position.
 */
export function isBughouseOverByCheckmate(position: BughousePositionSnapshot): boolean {
  const a = new Chess(position.fenA);
  if (isBughouseCheckmate(a)) return true;
  const b = new Chess(position.fenB);
  return isBughouseCheckmate(b);
}

/**
 * Create an initial analysis position:
 * - both boards at the standard chess start position
 * - empty reserves
 * - no promoted pieces
 */
export function createInitialPositionSnapshot(): BughousePositionSnapshot {
  const boardA = new Chess();
  const boardB = new Chess();
  return {
    fenA: boardA.fen(),
    fenB: boardB.fen(),
    reserves: createEmptyReserves(),
    promotedSquares: { A: [], B: [] },
  };
}

/**
 * Create an empty reserve structure for both boards.
 *
 * Shape is intentionally “total” (always contains A/B and white/black objects) so
 * downstream code can safely read/write counts without optional chaining.
 */
export function createEmptyReserves(): PieceReserves {
  return {
    A: { white: {}, black: {} },
    B: { white: {}, black: {} },
  };
}

/**
 * Returns whose turn it is on each board (independent bughouse turns).
 */
export function getAllowedActors(position: BughousePositionSnapshot): Array<{
  board: BughouseBoardId;
  side: "w" | "b";
}> {
  return [
    { board: "A", side: new Chess(position.fenA).turn() },
    { board: "B", side: new Chess(position.fenB).turn() },
  ];
}

/**
 * Options for move validation.
 */
export interface ValidateAndApplyOptions {
  /**
   * If true, skip the checkmate check at the start of validation.
   *
   * This is used when loading games from chess.com where a "simultaneous" move
   * on the other board may have been made at the exact moment checkmate occurred.
   * In bughouse, such moves are valid because players don't instantly know the
   * other board has ended.
   */
  bypassCheckmateCheck?: boolean;
}

/**
 * Validate an attempted move against the current bughouse position and apply it if legal.
 *
 * This is the core rules engine used by:
 * - interactive board moves/drops
 * - building a mainline from loaded chess.com games
 * - variation creation
 */
export function validateAndApplyBughouseHalfMove(
  position: BughousePositionSnapshot,
  attempted: AttemptedBughouseHalfMove,
  options?: ValidateAndApplyOptions,
): ValidateAndApplyResult {
  if (!options?.bypassCheckmateCheck && isBughouseOverByCheckmate(position)) {
    return { type: "error", message: "Game is already over." };
  }

  const boardKey = attempted.board;
  const otherBoardKey: BughouseBoardId = boardKey === "A" ? "B" : "A";

  const chess = new Chess(boardKey === "A" ? position.fenA : position.fenB);
  const sideToMove: BughouseSide = chess.turn() === "w" ? "white" : "black";

  const reserves = cloneReserves(position.reserves);
  const promotedSquares = clonePromotedSquares(position.promotedSquares);

  if (attempted.kind === "drop") {
    if (attempted.side !== sideToMove) {
      return {
        type: "error",
        message: `It is ${sideToMove} to move on board ${boardKey}.`,
      };
    }

    const to = attempted.to;
    const piece = attempted.piece;

    if (piece === "p") {
      const rank = to[1];
      if (rank === "1" || rank === "8") {
        return { type: "error", message: "Illegal pawn drop: cannot drop on rank 1 or 8." };
      }
    }

    if (chess.get(to)) {
      return { type: "error", message: `Square ${to} is not empty.` };
    }

    const count = reserves[boardKey][attempted.side][piece] ?? 0;
    if (count <= 0) {
      return { type: "error", message: `No ${piece.toUpperCase()} available to drop.` };
    }

    const putOk = chess.put(
      { type: piece as PieceSymbol, color: sideToMove === "white" ? ("w" as Color) : ("b" as Color) },
      to,
    );
    if (!putOk) {
      return { type: "error", message: `Failed to place ${piece.toUpperCase()} on ${to}.` };
    }

    /**
     * Legality: a bughouse drop is still a chess move. It must not leave the dropping side's
     * king in check.
     *
     * chess.js doesn't model drops as moves, but after `put()` the position is updated and
     * the side-to-move is still the dropping side, so `inCheck()` correctly answers:
     * “is the dropping side's king in check after this drop?”
     */
    if (chess.inCheck()) {
      return { type: "error", message: "Illegal drop." };
    }

    // Dropped pieces are never considered promoted; clear any stale marker.
    promotedSquares[boardKey].delete(to);

    // chess.js does not model bughouse drops as moves, so we must manually switch turn and clear EP.
    forceToggleTurnAndClearEnPassant(chess);

    const suffix = getBughouseCheckSuffix(chess);
    const san = `${piece.toUpperCase()}@${to}${suffix}`;
    reserves[boardKey][attempted.side][piece] = Math.max(0, count - 1);

    const edgeMove: BughouseHalfMove = {
      board: boardKey,
      side: sideToMove,
      kind: "drop",
      san,
      key: buildDropKey(boardKey, sideToMove, piece, to),
      drop: { piece, to },
    };

    const next = buildNextSnapshot(position, boardKey, chess.fen(), reserves, promotedSquares);
    return { type: "ok", move: edgeMove, next };
  }

  // Normal move
  const fromPiece = chess.get(attempted.from);
  if (!fromPiece) {
    return { type: "error", message: `No piece on ${attempted.from}.` };
  }

  if (sideToMove !== (fromPiece.color === "w" ? "white" : "black")) {
    return {
      type: "error",
      message: `It is ${sideToMove} to move on board ${boardKey}.`,
    };
  }

  const isPawnPromotionAttempt =
    fromPiece.type === "p" && (attempted.to[1] === "1" || attempted.to[1] === "8");

  if (isPawnPromotionAttempt && !attempted.promotion) {
    const legalPromotions = findLegalPromotions(chess, attempted.from, attempted.to);
    if (legalPromotions.length > 0) {
      return {
        type: "needs_promotion",
        message: "Promotion required.",
        allowed: legalPromotions,
      };
    }
  }

  let moveResult: Move | null = null;
  try {
    moveResult = chess.move({
      from: attempted.from,
      to: attempted.to,
      promotion: attempted.promotion,
    });
  } catch {
    // chess.js throws on invalid move objects (e.g. illegal or malformed from/to).
    // In analysis mode we want a graceful, user-facing rejection instead of a runtime error.
    return { type: "error", message: "Illegal move." };
  }

  if (!moveResult) return { type: "error", message: "Illegal move." };

  // Update promoted markers (for “promoted pieces capture as pawn” rule).
  const promotedSet = promotedSquares[boardKey];
  const movingWasPromoted = promotedSet.has(moveResult.from as Square);
  const capturedSquare = resolveCapturedSquare(moveResult);
  const capturedWasPromoted = capturedSquare ? promotedSet.has(capturedSquare) : false;

  promotedSet.delete(moveResult.from as Square);
  if (capturedSquare) {
    promotedSet.delete(capturedSquare);
  }

  if (moveResult.promotion) {
    promotedSet.add(moveResult.to as Square);
  } else if (movingWasPromoted) {
    promotedSet.add(moveResult.to as Square);
  }

  // Captures feed the partner board reserves.
  if (moveResult.captured) {
    const capturedPiece: BughousePieceType = (capturedWasPromoted ? "p" : moveResult.captured) as BughousePieceType;
    const receivingColor: BughouseSide = sideToMove === "white" ? "black" : "white";
    reserves[otherBoardKey][receivingColor][capturedPiece] =
      (reserves[otherBoardKey][receivingColor][capturedPiece] ?? 0) + 1;
  }

  const san = normalizeSanSuffixForBughouse({ san: moveResult.san, board: chess });
  const edgeMove: BughouseHalfMove = {
    board: boardKey,
    side: sideToMove,
    kind: "normal",
    san,
    key: buildNormalKey(boardKey, attempted.from, attempted.to, attempted.promotion),
    normal: { from: attempted.from, to: attempted.to, promotion: attempted.promotion },
  };

  const next = buildNextSnapshot(position, boardKey, chess.fen(), reserves, promotedSquares);
  return { type: "ok", move: edgeMove, next };
}

/**
 * Apply a move from notation (SAN-ish) produced by chess.com parsing or your UI.
 *
 * Used when loading a game: the interleaved `combinedMoves[]` stores string moves.
 */
export function validateAndApplyMoveFromNotation(
  position: BughousePositionSnapshot,
  params: { board: BughouseBoardId; side: BughouseSide; move: string },
  options?: ValidateAndApplyOptions,
): ValidateAndApplyResult {
  const { board, side } = params;
  const rawMove = params.move.trim();
  if (!rawMove) return { type: "error", message: "Empty move." };

  // Drop: `P@e4` (optionally with `+/#`).
  const dropParsed = parseDropMove(rawMove);
  if (dropParsed) {
    return validateAndApplyBughouseHalfMove(position, {
      kind: "drop",
      board,
      side,
      piece: dropParsed.piece,
      to: dropParsed.to,
    }, options);
  }

  // Normal: let chess.js parse + normalize, then replay it as a from/to move.
  const chess = new Chess(board === "A" ? position.fenA : position.fenB);
  const converted = validateAndConvertMove(rawMove, chess);
  if (!converted) return { type: "error", message: `Could not parse move: ${rawMove}` };

  let result: Move | null = null;
  try {
    result = chess.move(converted);
  } catch {
    return { type: "error", message: `Illegal move: ${rawMove}` };
  }
  if (!result) return { type: "error", message: `Illegal move: ${rawMove}` };
  chess.undo();

  return validateAndApplyBughouseHalfMove(position, {
    kind: "normal",
    board,
    from: result.from as Square,
    to: result.to as Square,
    promotion: result.promotion as BughousePromotionPiece | undefined,
  }, options);
}

function buildNextSnapshot(
  previous: BughousePositionSnapshot,
  boardKey: BughouseBoardId,
  nextFenForBoard: string,
  reserves: PieceReserves,
  promotedSquares: { A: Set<Square>; B: Set<Square> },
): BughousePositionSnapshot {
  return {
    fenA: boardKey === "A" ? nextFenForBoard : previous.fenA,
    fenB: boardKey === "B" ? nextFenForBoard : previous.fenB,
    reserves,
    promotedSquares: {
      A: Array.from(promotedSquares.A),
      B: Array.from(promotedSquares.B),
    },
  };
}

function cloneReserves(reserves: PieceReserves): PieceReserves {
  // Deep clone but keep it explicit + predictable for TS.
  const cloneSide = (obj: Record<string, number>) => ({ ...obj });
  return {
    A: { white: cloneSide(reserves.A.white), black: cloneSide(reserves.A.black) },
    B: { white: cloneSide(reserves.B.white), black: cloneSide(reserves.B.black) },
  };
}

function clonePromotedSquares(promotedSquares: BughousePositionSnapshot["promotedSquares"]): {
  A: Set<Square>;
  B: Set<Square>;
} {
  return {
    A: new Set(promotedSquares.A as Square[]),
    B: new Set(promotedSquares.B as Square[]),
  };
}

function buildNormalKey(
  board: BughouseBoardId,
  from: Square,
  to: Square,
  promotion?: BughousePromotionPiece,
): string {
  return `${board}:normal:${from}-${to}${promotion ? `=${promotion}` : ""}`;
}

function buildDropKey(
  board: BughouseBoardId,
  side: BughouseSide,
  piece: BughousePieceType,
  to: Square,
): string {
  return `${board}:drop:${side}:${piece}@${to}`;
}

function forceToggleTurnAndClearEnPassant(chess: Chess) {
  const fenParts = chess.fen().split(" ");
  // Active color
  fenParts[1] = fenParts[1] === "w" ? "b" : "w";
  // Clear en passant target to avoid illegal phantom EP after a drop.
  fenParts[3] = "-";
  chess.load(fenParts.join(" "));
}

function parseDropMove(move: string): { piece: BughousePieceType; to: Square } | null {
  const cleaned = move.replace(/[+#]$/, "");
  const match = cleaned.match(/^([PNBRQpnbrq])@([a-h][1-8])$/);
  if (!match) return null;
  const pieceChar = match[1].toLowerCase() as BughousePieceType;
  const to = match[2] as Square;
  return { piece: pieceChar, to };
}

function findLegalPromotions(
  chess: Chess,
  from: Square,
  to: Square,
): BughousePromotionPiece[] {
  const legal = chess.moves({ verbose: true }) as Array<Move>;
  const promotions: BughousePromotionPiece[] = [];
  for (const mv of legal) {
    if (mv.from === from && mv.to === to && mv.promotion) {
      const p = mv.promotion.toLowerCase() as BughousePromotionPiece;
      if (!promotions.includes(p)) promotions.push(p);
    }
  }
  return promotions;
}

function resolveCapturedSquare(result: Pick<Move, "captured" | "flags" | "to" | "color">): Square | null {
  if (!result.captured) return null;
  // En-passant is the only case where the captured piece is not on `to`.
  if (result.flags.includes("e")) {
    const file = result.to[0] as Square[0];
    const rank = result.color === "w" ? "5" : "4";
    return `${file}${rank}` as Square;
  }
  return result.to as Square;
}
