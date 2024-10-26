import { makeAutoObservable } from "mobx";
import { Chess } from "chess.js";
import { BughouseGameState, BughouseMove, BoardId } from "../types/bughouse";

export class BughouseStore {
  private gameState: BughouseGameState = {
    currentMoveNumber: 1,
    currentPosition: { A: "", B: "" },
    moves: [],
    capturedPieces: {
      teamAHolding: [],
      teamBHolding: [],
    },
  };
  private boardA: Chess;
  private boardB: Chess;
  private moveIndex: number = -1; // -1 means at start

  constructor() {
    makeAutoObservable(this);
    this.boardA = new Chess();
    this.boardB = new Chess();
    this.initializeGameState();
  }

  private initializeGameState() {
    this.gameState = {
      currentMoveNumber: 1,
      currentPosition: {
        A: this.boardA.fen(),
        B: this.boardB.fen(),
      },
      moves: [],
      capturedPieces: {
        teamAHolding: [], // Pieces that team A can drop
        teamBHolding: [], // Pieces that team B can drop
      },
    };
  }

  private handleCapture(boardId: BoardId, move: any) {
    if (!move.captured) return;

    // In Bughouse, captured pieces go to the opposite team on the other board
    const capturedPiece = move.captured.toLowerCase();
    const targetTeamHolding = boardId === "A" ? "teamBHolding" : "teamAHolding";

    const holding = this.gameState.capturedPieces[targetTeamHolding];
    const existingPiece = holding.find((p) => p.type === capturedPiece);

    if (existingPiece) {
      existingPiece.count++;
    } else {
      holding.push({ type: capturedPiece, count: 1 });
    }
  }

  private removePieceFromHolding(
    teamHolding: "teamAHolding" | "teamBHolding",
    pieceType: string
  ) {
    const holding = this.gameState.capturedPieces[teamHolding];
    const piece = holding.find((p) => p.type === pieceType);
    if (piece && piece.count > 0) {
      piece.count--;
      if (piece.count === 0) {
        const index = holding.indexOf(piece);
        holding.splice(index, 1);
      }
    }
  }

  makeMove(boardId: BoardId, move: string): boolean {
    const board = boardId === "A" ? this.boardA : this.boardB;
    const color = board.turn() === "w" ? "w" : "b";

    try {
      // Handle drops
      if (move.includes("@")) {
        const pieceType = move[0].toLowerCase();
        const teamHolding =
          boardId === "A"
            ? color === "w"
              ? "teamAHolding"
              : "teamBHolding"
            : color === "w"
            ? "teamBHolding"
            : "teamAHolding";

        // Check if the team has the piece to drop
        const holding = this.gameState.capturedPieces[teamHolding];
        if (!holding.find((p) => p.type === pieceType && p.count > 0)) {
          return false;
        }
      }

      // Attempt to make the move
      const result = board.move(move);
      if (!result) return false;

      // Handle captures and update holdings
      this.handleCapture(boardId, result);

      // If it was a drop, remove the piece from holdings
      if (move.includes("@")) {
        const pieceType = move[0].toLowerCase();
        const teamHolding =
          boardId === "A"
            ? color === "w"
              ? "teamAHolding"
              : "teamBHolding"
            : color === "w"
            ? "teamBHolding"
            : "teamAHolding";
        this.removePieceFromHolding(teamHolding, pieceType);
      }

      // Create and store the move
      const bughouseMove: BughouseMove = {
        boardId,
        color,
        moveNumber: this.gameState.currentMoveNumber,
        san: result.san,
        fen: board.fen(),
        isCheck: board.isCheck(),
        isCheckmate: board.isCheckmate(),
        isDrop: move.includes("@"),
      };

      // If we're not at the end of the move list, truncate future moves
      if (
        this.moveIndex !== -1 &&
        this.moveIndex < this.gameState.moves.length - 1
      ) {
        this.gameState.moves = this.gameState.moves.slice(
          0,
          this.moveIndex + 1
        );
      }

      this.gameState.moves.push(bughouseMove);
      this.moveIndex = this.gameState.moves.length - 1;
      this.gameState.currentPosition[boardId] = board.fen();

      if (color === "b") {
        this.gameState.currentMoveNumber++;
      }

      return true;
    } catch (e) {
      console.error("Invalid move:", e);
      return false;
    }
  }

  // Navigation methods
  goToMove(moveIndex: number) {
    if (moveIndex < -1 || moveIndex >= this.gameState.moves.length) return;

    // Reset both boards
    this.boardA = new Chess();
    this.boardB = new Chess();
    this.initializeGameState();

    // Replay moves up to the target index
    for (let i = 0; i <= moveIndex; i++) {
      const move = this.gameState.moves[i];
      const board = move.boardId === "A" ? this.boardA : this.boardB;
      board.move(move.san);
      this.handleCapture(
        move.boardId,
        board.history({ verbose: true })[board.history().length - 1]
      );
    }

    this.moveIndex = moveIndex;
    this.gameState.currentPosition = {
      A: this.boardA.fen(),
      B: this.boardB.fen(),
    };
  }

  goToStart() {
    this.goToMove(-1);
  }

  goToEnd() {
    this.goToMove(this.gameState.moves.length - 1);
  }

  goToPreviousMove() {
    this.goToMove(this.moveIndex - 1);
  }

  goToNextMove() {
    this.goToMove(this.moveIndex + 1);
  }

  // Getters for current state
  getFen(boardId: BoardId): string {
    return this.gameState.currentPosition[boardId];
  }

  getCurrentMoveIndex(): number {
    return this.moveIndex;
  }

  getHoldings(team: "A" | "B"): { type: string; count: number }[] {
    return this.gameState.capturedPieces[`team${team}Holding`];
  }
}
