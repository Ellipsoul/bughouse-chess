import type { Square } from "chess.js";
import type { PieceReserves } from "./bughouse";

export type BughouseBoardId = "A" | "B";

/**
 * Side-to-move / reserve ownership from the *local board* perspective.
 *
 * In bughouse, each board has its own side-to-move (independent turns),
 * and reserves are tracked per board + side.
 */
export type BughouseSide = "white" | "black";

export type BughousePieceType = "p" | "n" | "b" | "r" | "q";
export type BughousePromotionPiece = "q" | "r" | "b" | "n";

/**
 * Immutable snapshot of a bughouse position (both boards + reserves + promoted state).
 *
 * Notes:
 * - `fenA` / `fenB` include side-to-move per board; this is the source of truth for
 *   move permissions and legality validation.
 * - `promotedSquares` tracks the squares currently occupied by promoted pawns so that:
 *   - capturing a promoted piece yields a pawn in reserves (common bughouse rule)
 *   - future captures can be classified correctly
 */
export interface BughousePositionSnapshot {
  fenA: string;
  fenB: string;
  reserves: PieceReserves;
  promotedSquares: {
    A: string[];
    B: string[];
  };
}

export interface AttemptedNormalMove {
  kind: "normal";
  board: BughouseBoardId;
  from: Square;
  to: Square;
  promotion?: BughousePromotionPiece;
}

export interface AttemptedDropMove {
  kind: "drop";
  board: BughouseBoardId;
  /**
   * Reserves are owned by a side; drops must come from the side-to-move on the board.
   * The UI always knows which reserve the user clicked, so we pass it explicitly.
   */
  side: BughouseSide;
  piece: BughousePieceType;
  to: Square;
}

export type AttemptedBughouseHalfMove = AttemptedNormalMove | AttemptedDropMove;

/**
 * Canonical representation of a half-move edge in the analysis tree.
 *
 * We keep both display (`san`) and a stable identity (`key`) so UI operations
 * (like re-selecting an existing child) can match moves deterministically.
 */
export interface BughouseHalfMove {
  board: BughouseBoardId;
  side: BughouseSide;
  kind: "normal" | "drop";
  san: string;
  /**
   * Stable move identity.
   * - normal: `A:normal:e2-e4` or `A:normal:e7-e8=q`
   * - drop:   `B:drop:white:n@f7`
   */
  key: string;
  normal?: {
    from: Square;
    to: Square;
    promotion?: BughousePromotionPiece;
  };
  drop?: {
    piece: BughousePieceType;
    to: Square;
  };
}

export interface AnalysisNode {
  id: string;
  parentId: string | null;
  /**
   * The move that produced this node from its parent. Undefined for the root node.
   */
  incomingMove?: BughouseHalfMove;
  position: BughousePositionSnapshot;
  /**
   * Children are stored explicitly for stable ordering and O(1) branch discovery.
   */
  children: string[];
  /**
   * The “mainline” continuation out of this node (if any).
   * All other children are treated as variations.
   */
  mainChildId: string | null;
}

export interface AnalysisTree {
  rootId: string;
  nodesById: Record<string, AnalysisNode>;
}
