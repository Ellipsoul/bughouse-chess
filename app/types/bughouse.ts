/**
 * Move within an interleaved bughouse timeline.
 */
export interface BughouseMove {
  board: 'A' | 'B';
  moveNumber: number;
  move: string;
  timestamp: number;
  side: 'white' | 'black';
  fen?: string;
}

/**
 * Cumulative capture material ledger keyed by board and side.
 *
 * Values are signed from each player's perspective:
 * - positive: this player has captured more material than they've lost
 * - negative: this player has lost more material than they've captured
 *
 * This is *capture-only* accounting (drops/placements do not affect it).
 */
export type BughouseCaptureMaterialLedger = {
  A: { white: number; black: number };
  B: { white: number; black: number };
};

/**
 * Snapshot of both clocks (deciseconds) for a single board.
 */
export interface BoardClocks {
  white: number;
  black: number;
}

/**
 * Snapshot of both boards' clocks at a single moment in the (global) bughouse timeline.
 *
 * Notes:
 * - Values are expressed in **deciseconds** to match chess.com's bughouse payloads.
 * - Each board contains both players' remaining times on that board.
 */
export interface BughouseClocksSnapshotByBoard {
  A: BoardClocks;
  B: BoardClocks;
}

/**
 * UI-friendly representation of two boards plus shared data.
 */
export interface BughousePlayer {
  /**
   * Chess.com username as shown in the live game payload.
   */
  username: string;
  /**
   * Player rating (ELO) as returned by the live game payload.
   * Optional to keep the UI resilient when data is missing (e.g. partner game not found).
   */
  rating?: number;
  /**
   * Optional chess title from chess.com (e.g. "GM", "IM", "FM", "CM", "NM", and women-title variants).
   *
   * Important:
   * - Chess.com **omits** this property entirely for untitled players.
   * - Treat it as optional everywhere to avoid runtime errors when it is missing.
   */
  chessTitle?: string;
}

export interface BughouseGameState {
  boardA: {
    fen: string;
    moves: string[];
    currentMoveIndex: number;
    isPlaying: boolean;
    speed: number;
    clocks: BoardClocks;
  };
  boardB: {
    fen: string;
    moves: string[];
    currentMoveIndex: number;
    isPlaying: boolean;
    speed: number;
    clocks: BoardClocks;
  };
  promotedSquares: {
    A: string[];
    B: string[];
  };
  /**
   * Cumulative capture-material totals per board and per player.
   *
   * Bughouse material points:
   * - pawn: 1
   * - knight/bishop/rook: 2
   * - queen: 4
   *
   * Promoted pieces are treated as pawns for capture value (common bughouse rule).
   */
  captureMaterial: BughouseCaptureMaterialLedger;
  players: {
    aWhite: BughousePlayer;
    aBlack: BughousePlayer;
    bWhite: BughousePlayer;
    bBlack: BughousePlayer;
  };
}

export interface ProcessedGameData {
  originalGame: {
    moves: string[];
    timestamps: number[];
  };
  partnerGame: {
    moves: string[];
    timestamps: number[];
  };
  combinedMoves: BughouseMove[];
  initialTime: number;
  timeIncrement: number;
  players: {
    aWhite: BughousePlayer;
    aBlack: BughousePlayer;
    bWhite: BughousePlayer;
    bBlack: BughousePlayer;
  };
}

/**
 * Piece reserves keyed by board and color; counts represent capturable drops.
 */
export interface PieceReserves {
  A: {
    white: { [piece: string]: number };
    black: { [piece: string]: number };
  };
  B: {
    white: { [piece: string]: number };
    black: { [piece: string]: number };
  };
}
