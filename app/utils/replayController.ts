import { Chess, PieceSymbol, Color, Square } from 'chess.js';
import {
  BughouseClocksSnapshotByBoard,
  BughouseMove,
  BughouseGameState,
  BughousePlayer,
  ProcessedGameData,
  PieceReserves,
} from "../types/bughouse";
import { validateAndConvertMove } from './moveConverter';
import { getBughouseCheckSuffix, normalizeSanSuffixForBughouse } from './bughouseCheckmate';
import { buildBughouseClockTimeline } from "./analysis/buildBughouseClockTimeline";

interface BughouseHistoryState {
  fenA: string;
  fenB: string;
  pieceReserves: PieceReserves;
  boardAMoveCount: number;
  boardBMoveCount: number;
  promotedSquares: {
    A: string[];
    B: string[];
  };
}

/**
 * Imperative controller that replays bughouse moves across two boards, tracking clocks,
 * reserves, promotions, and enabling navigation (forward/back/jump).
 */
export class BughouseReplayController {
  private boardA: Chess;
  private boardB: Chess;
  private combinedMoves: BughouseMove[];
  private currentMoveIndex: number = -1;
  private pieceReserves: PieceReserves;
  private promotedPieces: { A: Set<string>; B: Set<string> };
  private initialTime: number;
  private clockTimeline: BughouseClocksSnapshotByBoard[];
  private moveDurationsByGlobalIndex: number[];
  private players: {
    aWhite: BughousePlayer;
    aBlack: BughousePlayer;
    bWhite: BughousePlayer;
    bBlack: BughousePlayer;
  };
  private gameState: BughouseGameState;
  private history: BughouseHistoryState[] = [];

  /**
   * Determine whether the last-applied move gives check/checkmate.
   *
   * Important: We call this **after** applying a move and flipping the active color in FEN.
   * At that point, the side-to-move is the *opponent*, so:
   * - `board.inCheck()` means the opponent is in check ⇒ the move was a checking move (`+`)
   * - `board.isCheckmate()` means the opponent is checkmated ⇒ the move was mate (`#`)
   */
  private getCheckSuffix(board: Chess): '' | '+' | '#' {
    return getBughouseCheckSuffix(board);
  }

  /**
   * Bughouse drops are represented as `P@e4` (optionally suffixed with `+` or `#`).
   * We accept/check-strip suffixes so the same string can be used for both replay execution
   * (where we need a clean square like `e4`) and display (where we may include `+/#`).
   */
  private parseDropMove(move: string): { pieceChar: string; square: Square } | null {
    const cleaned = move.replace(/[+#]$/, '');
    const match = cleaned.match(/^([PNBRQKpnbrqk])@([a-h][1-8])$/);
    if (!match) return null;
    return { pieceChar: match[1], square: match[2] as Square };
  }

  constructor(processedData: ProcessedGameData) {
    this.boardA = new Chess();
    this.boardB = new Chess();
    this.combinedMoves = processedData.combinedMoves;
    this.initialTime = processedData.initialTime;
    this.pieceReserves = {
      A: { white: {}, black: {} },
      B: { white: {}, black: {} }
    };
    this.promotedPieces = { A: new Set(), B: new Set() };

    const { timeline, moveDurationsByGlobalIndex } = buildBughouseClockTimeline(processedData);
    this.clockTimeline = timeline;
    this.moveDurationsByGlobalIndex = moveDurationsByGlobalIndex;
    this.players = processedData.players;
    this.gameState = {
      boardA: {
        fen: this.boardA.fen(),
        moves: [],
        currentMoveIndex: 0,
        isPlaying: false,
        speed: 1,
        clocks: this.getClockSnapshotAtGlobalMoveIndex(-1).A
      },
      boardB: {
        fen: this.boardB.fen(),
        moves: [],
        currentMoveIndex: 0,
        isPlaying: false,
        speed: 1,
        clocks: this.getClockSnapshotAtGlobalMoveIndex(-1).B
      },
      promotedSquares: {
        A: [],
        B: []
      },
      players: this.players
    };

    this.sanitizeMoves();
  }

  private clonePromotedPieces(): { A: string[]; B: string[] } {
    return {
      A: Array.from(this.promotedPieces.A),
      B: Array.from(this.promotedPieces.B)
    };
  }

  private getClockSnapshotAtGlobalMoveIndex(globalMoveIndex: number): BughouseClocksSnapshotByBoard {
    if (!this.clockTimeline.length) {
      return { A: { white: 0, black: 0 }, B: { white: 0, black: 0 } };
    }

    // `clockTimeline[0]` is the start position (before any moves).
    const timelineIndex = globalMoveIndex + 1;
    const clampedIndex = Math.min(Math.max(timelineIndex, 0), this.clockTimeline.length - 1);
    return this.clockTimeline[clampedIndex];
  }

  private refreshClocks() {
    const snapshot = this.getClockSnapshotAtGlobalMoveIndex(this.currentMoveIndex);
    this.gameState.boardA.clocks = snapshot.A;
    this.gameState.boardB.clocks = snapshot.B;
  }

  /**
   * Normalize move strings up-front so live execution is predictable and reversible.
   */
  private sanitizeMoves() {
    const tempBoardA = new Chess();
    const tempBoardB = new Chess();

    for (const move of this.combinedMoves) {
      const board = move.board === 'A' ? tempBoardA : tempBoardB;

      if (this.isDropMove(move.move)) {
        this.applyDropMoveOnBoard(board, move);
      } else if (this.isCastleMove(move.move)) {
        try {
          const normalized = move.move.replace(/0/g, 'O');
          const result = board.move(normalized);
          if (result) {
            move.move = normalizeSanSuffixForBughouse({ san: result.san, board });
          }
        } catch (e) {
          console.error('Sanitize castle error', e);
        }
      } else {
        try {
          // Use validateAndConvertMove to handle potential format issues
          // It returns a string that board.move() will accept
          const validStr = validateAndConvertMove(move.move, board);
          if (validStr) {
            const result = board.move(validStr);
            if (result) {
              move.move = normalizeSanSuffixForBughouse({ san: result.san, board });
            }
          }
        } catch (e) {
          console.error(`Error sanitizing move ${move.move}`, e);
        }
      }
    }
  }

  private applyDropMoveOnBoard(board: Chess, move: BughouseMove) {
    const parsed = this.parseDropMove(move.move);
    if (!parsed) return;

    const pieceChar = parsed.pieceChar;
    const square = parsed.square;
    const pieceType = pieceChar.toLowerCase();
    const color = move.side === 'white' ? 'w' : 'b';

    try {
      board.put({ type: pieceType as PieceSymbol, color: color as Color }, square as Square);

      const fen = board.fen();
      const fenParts = fen.split(' ');
      fenParts[1] = fenParts[1] === 'w' ? 'b' : 'w';
      fenParts[3] = '-';
      board.load(fenParts.join(' '));

      // After a move is made, the side to move is the *opponent*.
      // If the opponent is now in check, this move is a checking move.
      const suffix = this.getCheckSuffix(board);
      move.move = `${pieceChar.toUpperCase()}@${square}${suffix}`;
    } catch (e) {
      console.error('Error applying drop move during sanitization', e);
    }
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
      },
      promotedSquares: {
        A: Array.from(this.promotedPieces.A),
        B: Array.from(this.promotedPieces.B)
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
      boardBMoveCount: this.gameState.boardB.moves.length,
      promotedSquares: this.clonePromotedPieces()
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
    this.promotedPieces = {
      A: new Set(prevState.promotedSquares.A),
      B: new Set(prevState.promotedSquares.B)
    };

    // Restore game state counters/arrays
    // We trim the moves array to the previous length
    this.gameState.boardA.moves.length = prevState.boardAMoveCount;
    this.gameState.boardA.currentMoveIndex = prevState.boardAMoveCount;
    this.gameState.boardB.moves.length = prevState.boardBMoveCount;
    this.gameState.boardB.currentMoveIndex = prevState.boardBMoveCount;

    this.currentMoveIndex--;
    this.refreshClocks();
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

  /**
   * Execute a single move on the correct board, updating reserves/promotions/clocks.
   */
  private executeMove(move: BughouseMove): boolean {
    const board = move.board === 'A' ? this.boardA : this.boardB;
    const boardKey = move.board;

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
          // Ensure notation uses bughouse-aware `+/#` (chess.js `#` is regular-chess checkmate).
          move.move = normalizeSanSuffixForBughouse({ san: result.san, board });

          const promotedSet = this.promotedPieces[boardKey];
          const movingPromoted = promotedSet.has(result.from);
          const capturedSquare = this.resolveCapturedSquare(result);
          const capturedWasPromoted = capturedSquare ? promotedSet.has(capturedSquare) : false;

          promotedSet.delete(result.from);
          if (capturedSquare) {
            promotedSet.delete(capturedSquare);
          }
          if (result.promotion) {
            promotedSet.add(result.to);
          } else if (movingPromoted) {
            promotedSet.add(result.to);
          }

          // Handle captures - add captured piece to partner's reserve
          if (result.captured) {
            const partnerBoard = move.board === 'A' ? 'B' : 'A';
            const capturedPiece = capturedWasPromoted ? 'p' : result.captured; // 'p', 'n', etc.

            const receivingColor = move.side === 'white' ? 'black' : 'white';

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
    const moveStr = move.move; // e.g., "P@e4" or "P@e4+"

    // Parse drop move (tolerates trailing `+/#`).
    const parsed = this.parseDropMove(moveStr);
    if (!parsed) return false;

    const pieceChar = parsed.pieceChar;
    const square = parsed.square;
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
        // Dropped pieces are never promoted; ensure we clear any stale marker
        this.promotedPieces[move.board].delete(square);

        // Manually switch turn and clear en passant
        const fen = board.fen();
        const fenParts = fen.split(' ');
        fenParts[1] = fenParts[1] === 'w' ? 'b' : 'w'; // Switch active color
        fenParts[3] = '-'; // Clear en passant target
        board.load(fenParts.join(' '));

        // Normalize the stored notation to include check/checkmate when applicable.
        const suffix = this.getCheckSuffix(board);
        move.move = `${pieceChar.toUpperCase()}@${square}${suffix}`;

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
         // Ensure notation uses bughouse-aware `+/#` (chess.js `#` is regular-chess checkmate).
         move.move = normalizeSanSuffixForBughouse({ san: result.san, board });
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

    this.refreshClocks();
    this.gameState.promotedSquares = this.clonePromotedPieces();
  }

  private resolveCapturedSquare(result: {
    captured?: string;
    flags: string;
    to: string;
    color: string;
  }): string | null {
    if (!result.captured) return null;

    // En-passant is the only case where the captured piece is not on `to`.
    if (result.flags.includes('e')) {
      const file = result.to[0];
      const rank = result.color === 'w' ? '5' : '4';
      return `${file}${rank}`;
    }

    return result.to;
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

  public getCombinedMoves(): BughouseMove[] {
    return this.combinedMoves;
  }

  /**
   * Per-move “time spent” values (deciseconds), aligned with `getCombinedMoves()` indices.
   *
   * These are computed from the same global bughouse clock simulation that drives the
   * board clock display, so the move list and clocks cannot diverge.
   */
  public getMoveDurations(): number[] {
    return this.moveDurationsByGlobalIndex.slice();
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
