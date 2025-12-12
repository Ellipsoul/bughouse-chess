import { Chess, PieceSymbol, Color, Square } from 'chess.js';
import { BughouseMove, BughouseGameState, ProcessedGameData, PieceReserves } from '../types/bughouse';
import { validateAndConvertMove } from './moveConverter';

interface BughouseHistoryState {
  fenA: string;
  fenB: string;
  pieceReserves: PieceReserves;
  boardAMoveCount: number;
  boardBMoveCount: number;
}

export class BughouseReplayController {
  private boardA: Chess;
  private boardB: Chess;
  private combinedMoves: BughouseMove[];
  private currentMoveIndex: number = -1;
  private pieceReserves: PieceReserves;
  private players: {
    aWhite: string;
    aBlack: string;
    bWhite: string;
    bBlack: string;
  };
  private gameState: BughouseGameState;
  private history: BughouseHistoryState[] = [];

  constructor(processedData: ProcessedGameData) {
    this.boardA = new Chess();
    this.boardB = new Chess();
    this.combinedMoves = processedData.combinedMoves;
    this.pieceReserves = {
      A: { white: {}, black: {} },
      B: { white: {}, black: {} }
    };
    this.players = processedData.players;
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
      },
      players: this.players
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

  public getCurrentPieceReserves(): PieceReserves {
    return JSON.parse(JSON.stringify(this.pieceReserves));
  }

  public canMoveForward(): boolean {
    return this.currentMoveIndex < this.combinedMoves.length - 1;
  }

  public canMoveBackward(): boolean {
    return this.currentMoveIndex >= 0;
  }

  public moveForward(): boolean {
    if (!this.canMoveForward()) return false;

    // Save current state to history before moving
    this.history.push({
      fenA: this.boardA.fen(),
      fenB: this.boardB.fen(),
      pieceReserves: JSON.parse(JSON.stringify(this.pieceReserves)),
      boardAMoveCount: this.gameState.boardA.moves.length,
      boardBMoveCount: this.gameState.boardB.moves.length
    });

    this.currentMoveIndex++;
    const move = this.combinedMoves[this.currentMoveIndex];
    return this.executeMove(move);
  }

  public moveBackward(): boolean {
    if (!this.canMoveBackward()) return false;
    if (this.history.length === 0) return false;

    // Restore previous state
    const prevState = this.history.pop();
    if (!prevState) return false;

    this.boardA.load(prevState.fenA);
    this.boardB.load(prevState.fenB);
    this.pieceReserves = prevState.pieceReserves;

    // Restore game state counters/arrays
    // We trim the moves array to the previous length
    this.gameState.boardA.moves.length = prevState.boardAMoveCount;
    this.gameState.boardA.currentMoveIndex = prevState.boardAMoveCount;
    this.gameState.boardB.moves.length = prevState.boardBMoveCount;
    this.gameState.boardB.currentMoveIndex = prevState.boardBMoveCount;

    this.currentMoveIndex--;
    return true;
  }

  public jumpToMove(moveIndex: number): boolean {
    // If target is -1 (start), we want to go back past 0
    if (moveIndex < -1 || moveIndex >= this.combinedMoves.length) return false;

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
      if (this.isDropMove(move.move)) {
        return this.executeDropMove(move);
      } else if (this.isCastleMove(move.move)) {
        return this.executeCastleMove(move);
      } else {
        // Regular move
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
            const capturedPiece = result.captured; // 'p', 'n', etc.
            // Note: In bughouse, promoted pieces revert to pawns upon capture.
            // chess.js doesn't explicitly flag promoted pieces in capture result,
            // but for now we assume standard piece capture.
            // Strict rule: "Pawns that have promoted revert to pawns when captured."
            // We would need to track promotion history to do this perfectly,
            // but for now we'll use the captured type.

            const receivingColor = move.side; // The side that captured gets the piece

            if (!this.pieceReserves[partnerBoard][receivingColor][capturedPiece]) {
              this.pieceReserves[partnerBoard][receivingColor][capturedPiece] = 0;
            }
            this.pieceReserves[partnerBoard][receivingColor][capturedPiece]++;
          }

          this.updateGameState(move);
          return true;
        }
      }
    } catch (error) {
      console.error('Error executing move:', error);
    }

    return false;
  }

  private executeDropMove(move: BughouseMove): boolean {
    const board = move.board === 'A' ? this.boardA : this.boardB;
    const moveStr = move.move; // e.g., "P@e4"

    // Parse drop move
    const parts = moveStr.split('@');
    if (parts.length !== 2) return false;

    const pieceChar = parts[0];
    const square = parts[1];
    const pieceType = pieceChar.toLowerCase(); // 'p', 'n', 'b', 'r', 'q'
    const color = move.side === 'white' ? 'w' : 'b';

    // Validate reserve
    const reserves = this.pieceReserves[move.board][move.side];
    if (!reserves[pieceType] || reserves[pieceType] <= 0) {
      console.warn(`Attempting to drop ${pieceType} on ${square} but reserve is empty/missing`, reserves);
      // We proceed anyway to keep replay going if possible, assuming PGN is correct
    }

    try {
      // Place the piece
      const success = board.put({ type: pieceType as PieceSymbol, color: color as Color }, square as Square);

      if (success) {
        // Manually switch turn and clear en passant
        const fen = board.fen();
        const fenParts = fen.split(' ');
        fenParts[1] = fenParts[1] === 'w' ? 'b' : 'w'; // Switch active color
        fenParts[3] = '-'; // Clear en passant target
        board.load(fenParts.join(' '));

        // Decrement reserve
        if (reserves && reserves[pieceType] > 0) {
          reserves[pieceType]--;
        }

        this.updateGameState(move);
        return true;
      }
    } catch (error) {
      console.error('Error executing drop move:', error);
    }

    return false;
  }

  private executeCastleMove(move: BughouseMove): boolean {
    const board = move.board === 'A' ? this.boardA : this.boardB;

    try {
      // Normalize castle notation
      const normalizedMove = move.move.replace(/0/g, 'O');
      const result = board.move(normalizedMove);
      if (result) {
         this.updateGameState(move);
         return true;
      }
    } catch (error) {
      console.error('Error executing castle move:', error);
    }
    return false;
  }

  private updateGameState(move: BughouseMove) {
    if (move.board === 'A') {
      this.gameState.boardA.moves.push(move.move);
      this.gameState.boardA.currentMoveIndex++;
    } else {
      this.gameState.boardB.moves.push(move.move);
      this.gameState.boardB.currentMoveIndex++;
    }
  }

  private isDropMove(move: string): boolean {
    return move.includes('@');
  }

  private isCastleMove(move: string): boolean {
    return move === 'O-O' || move === 'O-O-O' || move === '0-0' || move === '0-0-0';
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

  public getDebugInfo(): string {
    let debugInfo = `BPGN (Bughouse Portable Game Notation)\n`;
    debugInfo += `Players: ${this.players.aWhite} & ${this.players.bBlack} vs ${this.players.aBlack} & ${this.players.bWhite}\n\n`;
    debugInfo += `Move Order by Timestamp:\n`;

    this.combinedMoves.forEach((move, index) => {
      const moveStr = `${index + 1}. Board ${move.board} (${move.side}): ${move.move} [${move.timestamp.toFixed(3)}s]`;
      if (index === this.currentMoveIndex) {
        debugInfo += `> ${moveStr} < CURRENT\n`;
      } else {
        debugInfo += `  ${moveStr}\n`;
      }
    });

    return debugInfo;
  }
}
