import "./mobxConfig"; // Import this first
import { makeAutoObservable } from "mobx";
import { Chess } from "chess.js";

type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
type PieceColor = "w" | "b";

interface CapturedPiece {
  type: PieceType;
  color: PieceColor;
}

export class GameStore {
  // Two chess instances for the two boards
  board1: Chess;
  board2: Chess;

  // Captured pieces available for drops
  capturedPiecesTeam1: CapturedPiece[] = [];
  capturedPiecesTeam2: CapturedPiece[] = [];

  constructor() {
    makeAutoObservable(this);
    this.board1 = new Chess();
    this.board2 = new Chess();
  }

  // Move a piece on board 1
  makeMove1(from: string, to: string) {
    try {
      const move = this.board1.move({ from, to });
      if (move && move.captured) {
        // When a piece is captured on board 1, it goes to team 2's reserves
        this.capturedPiecesTeam2.push({
          type: move.captured as PieceType,
          color: move.color === "w" ? "b" : "w",
        });
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  // Move a piece on board 2
  makeMove2(from: string, to: string) {
    try {
      const move = this.board2.move({ from, to });
      if (move && move.captured) {
        // When a piece is captured on board 2, it goes to team 1's reserves
        this.capturedPiecesTeam1.push({
          type: move.captured as PieceType,
          color: move.color === "w" ? "b" : "w",
        });
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  // Drop a piece from reserves onto board 1
  dropPiece1(piece: CapturedPiece, square: string) {
    // Implementation for dropping pieces on board 1
    // This will need to be implemented according to bughouse rules
  }

  // Drop a piece from reserves onto board 2
  dropPiece2(piece: CapturedPiece, square: string) {
    // Implementation for dropping pieces on board 2
    // This will need to be implemented according to bughouse rules
  }

  // Get the current FEN for board 1
  getFen1() {
    return this.board1.fen();
  }

  // Get the current FEN for board 2
  getFen2() {
    return this.board2.fen();
  }

  // Reset both boards to initial position
  resetBoards() {
    this.board1.reset();
    this.board2.reset();
    this.capturedPiecesTeam1 = [];
    this.capturedPiecesTeam2 = [];
  }
}

// Create a single instance of the store
export const gameStore = new GameStore();
