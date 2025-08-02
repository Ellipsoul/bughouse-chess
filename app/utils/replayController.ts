import { Chess } from 'chess.js';
import { BughouseMove, BughouseGameState, ProcessedGameData } from '../types/bughouse';
import { validateAndConvertMove } from './moveConverter';

export class BughouseReplayController {
  private boardA: Chess;
  private boardB: Chess;
  private combinedMoves: BughouseMove[];
  private currentMoveIndex: number = -1;
  private pieceReserves: { A: string[], B: string[] };
  private gameState: BughouseGameState;

  constructor(processedData: ProcessedGameData) {
    this.boardA = new Chess();
    this.boardB = new Chess();
    this.combinedMoves = processedData.combinedMoves;
    this.pieceReserves = { A: [], B: [] };
    this.gameState = {
      boardA: {
        fen: this.boardA.fen(),
        moves: [],
        currentMoveIndex: 0,
        isPlaying: false,
        speed: 1
      },
      boardB: {
        fen: this.boardB.fen(),
        moves: [],
        currentMoveIndex: 0,
        isPlaying: false,
        speed: 1
      }
    };
  }

  public getCurrentGameState(): BughouseGameState {
    return {
      ...this.gameState,
      boardA: {
        ...this.gameState.boardA,
        fen: this.boardA.fen()
      },
      boardB: {
        ...this.gameState.boardB,
        fen: this.boardB.fen()
      }
    };
  }

  public getCurrentPieceReserves(): { A: string[], B: string[] } {
    return { ...this.pieceReserves };
  }

  public canMoveForward(): boolean {
    return this.currentMoveIndex < this.combinedMoves.length - 1;
  }

  public canMoveBackward(): boolean {
    return this.currentMoveIndex > 0;
  }

  public moveForward(): boolean {
    if (!this.canMoveForward()) return false;

    this.currentMoveIndex++;
    const move = this.combinedMoves[this.currentMoveIndex];
    return this.executeMove(move);
  }

  public moveBackward(): boolean {
    if (!this.canMoveBackward()) return false;

    const move = this.combinedMoves[this.currentMoveIndex];
    const success = this.undoMove(move);
    if (success) {
      this.currentMoveIndex--;
    }
    return success;
  }

  public jumpToMove(moveIndex: number): boolean {
    if (moveIndex < 0 || moveIndex >= this.combinedMoves.length) return false;

    // If moving forward
    if (moveIndex > this.currentMoveIndex) {
      while (this.currentMoveIndex < moveIndex) {
        if (!this.moveForward()) return false;
      }
    }
    // If moving backward
    else if (moveIndex < this.currentMoveIndex) {
      while (this.currentMoveIndex > moveIndex) {
        if (!this.moveBackward()) return false;
      }
    }

    return true;
  }

  private executeMove(move: BughouseMove): boolean {
    const board = move.board === 'A' ? this.boardA : this.boardB;
    
    try {
      // Handle different types of moves based on the legacy bug.js logic
      if (this.isDropMove(move.move)) {
        return this.executeDropMove(move);
      } else if (this.isCastleMove(move.move)) {
        return this.executeCastleMove(move);
      } else {
        // Regular move - convert if necessary
        const convertedMove = validateAndConvertMove(move.move, board);
        if (!convertedMove) {
          console.error(`Could not convert move: ${move.move}`);
          return false;
        }
        
        const result = board.move(convertedMove);
        if (result) {
          // Handle captures - add captured piece to partner's reserve
          if (result.captured) {
            const partnerBoard = move.board === 'A' ? 'B' : 'A';
            const capturedPiece = result.captured;
            this.pieceReserves[partnerBoard].push(capturedPiece);
          }
          
          // Update game state
          if (move.board === 'A') {
            this.gameState.boardA.moves.push(move.move);
            this.gameState.boardA.currentMoveIndex++;
          } else {
            this.gameState.boardB.moves.push(move.move);
            this.gameState.boardB.currentMoveIndex++;
          }
          
          return true;
        }
      }
    } catch (error) {
      console.error('Error executing move:', error);
    }
    
    return false;
  }

  private undoMove(move: BughouseMove): boolean {
    const board = move.board === 'A' ? this.boardA : this.boardB;
    
    try {
      board.undo();
      
      // Remove the move from game state
      if (move.board === 'A') {
        this.gameState.boardA.moves.pop();
        this.gameState.boardA.currentMoveIndex--;
      } else {
        this.gameState.boardB.moves.pop();
        this.gameState.boardB.currentMoveIndex--;
      }
      
      // Handle piece reserve restoration (simplified)
      // In a full implementation, we'd need to track what was captured
      
      return true;
    } catch (error) {
      console.error('Error undoing move:', error);
      return false;
    }
  }

  private isDropMove(move: string): boolean {
    // Check if move is a drop move (piece placement from reserve)
    // Drop moves typically look like: P@e4, N@f3, etc.
    return move.includes('@');
  }

  private isCastleMove(move: string): boolean {
    return move === 'O-O' || move === 'O-O-O' || move === '0-0' || move === '0-0-0';
  }

  private executeDropMove(move: BughouseMove): boolean {
    // Drop moves aren't natively supported by chess.js
    // We'd need custom logic here to handle piece drops
    // For now, we'll log and return false
    console.log('Drop move not yet implemented:', move);
    return false;
  }

  private executeCastleMove(move: BughouseMove): boolean {
    const board = move.board === 'A' ? this.boardA : this.boardB;
    
    try {
      // Normalize castle notation
      const normalizedMove = move.move.replace(/0/g, 'O');
      const result = board.move(normalizedMove);
      return !!result;
    } catch (error) {
      console.error('Error executing castle move:', error);
      return false;
    }
  }

  public reset(): void {
    this.boardA.reset();
    this.boardB.reset();
    this.currentMoveIndex = 0;
    this.pieceReserves = { A: [], B: [] };
    this.gameState = {
      boardA: {
        fen: this.boardA.fen(),
        moves: [],
        currentMoveIndex: 0,
        isPlaying: false,
        speed: 1
      },
      boardB: {
        fen: this.boardB.fen(),
        moves: [],
        currentMoveIndex: 0,
        isPlaying: false,
        speed: 1
      }
    };
  }

  public getCurrentMoveIndex(): number {
    return this.currentMoveIndex;
  }

  public getTotalMoves(): number {
    return this.combinedMoves.length;
  }

  public getCurrentMove(): BughouseMove | null {
    if (this.currentMoveIndex >= 0 && this.currentMoveIndex < this.combinedMoves.length) {
      return this.combinedMoves[this.currentMoveIndex];
    }
    return null;
  }
}
