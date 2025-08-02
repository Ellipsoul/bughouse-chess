// Type definitions for bughouse game replay system

export interface BughouseMove {
  board: 'A' | 'B';
  moveNumber: number;
  move: string;
  timestamp: number;
  side: 'white' | 'black';
  fen?: string;
}

export interface BughouseGameState {
  boardA: string; // FEN string
  boardB: string; // FEN string
  currentMoveIndex: number;
  moves: BughouseMove[];
  isPlaying: boolean;
  speed: number; // playback speed multiplier
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
}
