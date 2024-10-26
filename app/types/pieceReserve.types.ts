import { CapturedPiece } from "./bughouseStore.types";

export interface PieceReserveProps {
  side: "left" | "right";
  pieces: CapturedPiece[];
  boardWidth: number;
}
