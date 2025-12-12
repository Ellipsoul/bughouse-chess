// Type definitions for bughouse game replay system

export interface BughouseMove {
  board: 'A' | 'B';
  moveNumber: number;
  move: string;
  timestamp: number;
  side: 'white' | 'black';
  fen?: string;
}

export interface BoardClocks {
  white: number;
  black: number;
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
    aWhite: string;
    aBlack: string;
    bWhite: string;
    bBlack: string;
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
    aWhite: string;
    aBlack: string;
    bWhite: string;
    bBlack: string;
  };
}

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
