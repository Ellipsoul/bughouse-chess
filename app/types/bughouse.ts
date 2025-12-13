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
 * Snapshot of both clocks (deciseconds) for a single board.
 */
export interface BoardClocks {
  white: number;
  black: number;
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
