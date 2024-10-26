export interface SquareStyle {
  background: string;
  borderRadius?: string;
}

export interface SquareStyles {
  [square: string]: SquareStyle;
}

export interface CapturedPiece {
  type: string;
  color: "w" | "b";
  count: number;
}
