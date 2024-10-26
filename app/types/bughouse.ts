import { Square } from "chess.js";

export type BoardId = "A" | "B";
export type TeamHolding = "teamAHolding" | "teamBHolding";

export interface BughouseMove {
  boardId: BoardId;
  color: "w" | "b";
  moveNumber: number;
  san: string;
  fen: string;
  isCheck: boolean;
  isCheckmate: boolean;
  isDrop: boolean;
}

export interface CapturedPiece {
  type: string;
  count: number;
}

export interface BughouseGameState {
  currentMoveNumber: number;
  currentPosition: {
    A: string;
    B: string;
  };
  moves: BughouseMove[];
  capturedPieces: {
    teamAHolding: CapturedPiece[];
    teamBHolding: CapturedPiece[];
  };
}

export interface ChessMove {
  color: "w" | "b";
  from: Square;
  to: Square;
  flags: string;
  piece: string;
  san: string;
  captured?: string;
  promotion?: string;
}
