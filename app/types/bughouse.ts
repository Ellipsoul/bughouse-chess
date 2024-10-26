export type BoardId = "A" | "B";
export type Color = "w" | "b";

export interface BughouseMove {
  boardId: BoardId;
  color: Color;
  moveNumber: number;
  san: string; // Standard Algebraic Notation
  fen: string; // Position after move
  isCheck?: boolean;
  isCheckmate?: boolean;
  isDrop?: boolean;
}

export interface BughouseGameState {
  currentMoveNumber: number;
  currentPosition: {
    A: string; // FEN for board A
    B: string; // FEN for board B
  };
  moves: BughouseMove[];
  capturedPieces: {
    teamAHolding: { type: string; count: number }[];
    teamBHolding: { type: string; count: number }[];
  };
}
