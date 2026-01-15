import type { BughouseBoardId, BughouseSide } from "../types/analysis";
import type { BughousePlayer } from "../types/bughouse";

export type BoardOrder = {
  leftBoardId: BughouseBoardId;
  rightBoardId: BughouseBoardId;
};

export type BughousePlayers = {
  aWhite: BughousePlayer;
  aBlack: BughousePlayer;
  bWhite: BughousePlayer;
  bBlack: BughousePlayer;
};

/**
 * Resolve which logical board should be rendered on the left/right.
 */
export function getBoardOrder(isBoardOrderSwapped: boolean): BoardOrder {
  return isBoardOrderSwapped
    ? { leftBoardId: "B", rightBoardId: "A" }
    : { leftBoardId: "A", rightBoardId: "B" };
}

/**
 * Map a logical board to its display label when the UI is swapped.
 *
 * This keeps internal data (always A/B) stable while letting the UI show
 * the boards in their swapped left/right positions.
 */
export function getDisplayBoardLabel(
  boardId: BughouseBoardId,
  isBoardOrderSwapped: boolean,
): BughouseBoardId {
  if (!isBoardOrderSwapped) return boardId;
  return boardId === "A" ? "B" : "A";
}

/**
 * Determine which move-list column a move should render in.
 *
 * Column indices:
 * - 0: left board, white
 * - 1: left board, black
 * - 2: right board, white
 * - 3: right board, black
 */
export function getMoveListColumnIndex(params: {
  boardId: BughouseBoardId;
  side: BughouseSide;
  isBoardOrderSwapped: boolean;
}): number {
  const { boardId, side, isBoardOrderSwapped } = params;
  const { leftBoardId } = getBoardOrder(isBoardOrderSwapped);
  const isLeftBoard = boardId === leftBoardId;

  if (isLeftBoard) {
    return side === "white" ? 0 : 1;
  }
  return side === "white" ? 2 : 3;
}

/**
 * Get the white/black players for a given logical board.
 */
export function getPlayersForBoard(
  players: BughousePlayers,
  boardId: BughouseBoardId,
): { white: BughousePlayer; black: BughousePlayer } {
  return boardId === "A"
    ? { white: players.aWhite, black: players.aBlack }
    : { white: players.bWhite, black: players.bBlack };
}
