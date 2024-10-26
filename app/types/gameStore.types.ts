export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type PieceColor = "w" | "b";

export interface CapturedPiece {
  type: PieceType;
  color: PieceColor;
}
