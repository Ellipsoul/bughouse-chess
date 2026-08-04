/**
 * Core bughouse domain types shared across replay, analysis, and UI layers.
 *
 * These types describe the interleaved two-board move timeline, clock snapshots,
 * player identities, reserves, and the processed shape produced when loading
 * chess.com live-game payloads.
 */

/**
 * A single half-move in the global (interleaved) bughouse timeline.
 *
 * `timestamp` is elapsed time since game start in **deciseconds**, as reconstructed
 * from chess.com's per-move remaining-time series.
 */
export interface BughouseMove {
  /** Logical board on which the move was played. */
  board: 'A' | 'B';
  /** Full-move number on that board (1-based). */
  moveNumber: number;
  /** SAN-ish move string, including bughouse drops (`P@e4`). */
  move: string;
  /** Elapsed time (deciseconds) when this move occurred in the global timeline. */
  timestamp: number;
  /** Color of the player who made this move. */
  side: 'white' | 'black';
  /** Optional FEN after the move; populated by some code paths for caching. */
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
 * Remaining clock time (deciseconds) for both players on a single board.
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
 * A player identity as shown in chess.com live-game payloads.
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

/**
 * UI-friendly snapshot of both boards plus shared bughouse state.
 *
 * Used by the replay controller and board components for rendering FEN, move history,
 * clocks, reserves, and capture-material HUD counters.
 */
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
  /** Squares occupied by promoted pieces, tracked for "promoted captures count as pawn" rule. */
  promotedSquares: {
    A: string[];
    B: string[];
  };
  /**
   * Cumulative capture-material totals per board and per player.
   *
   * Material points use the user's selected preset. The default Bughouse values are
   * pawn 1.5, knight/bishop 3, rook 4, and queen 7.
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

/**
 * Normalized output of {@link processGameData}: per-board move lists, interleaved timeline,
 * player identities, and clock configuration extracted from chess.com payloads.
 */
export interface ProcessedGameData {
  /** Board A (original game) moves and raw timestamp series. */
  originalGame: {
    moves: string[];
    timestamps: number[];
  };
  /** Board B (partner game) moves and raw timestamp series. */
  partnerGame: {
    moves: string[];
    timestamps: number[];
  };
  /** Chronologically merged move list used for replay and live analysis. */
  combinedMoves: BughouseMove[];
  /** Initial clock time per player in seconds (from chess.com `baseTime1`). */
  initialTime: number;
  /** Increment per move in seconds (from chess.com `timeIncrement1`). */
  timeIncrement: number;
  players: {
    aWhite: BughousePlayer;
    aBlack: BughousePlayer;
    bWhite: BughousePlayer;
    bBlack: BughousePlayer;
  };
}

/**
 * Captured-piece reserves available for drops, keyed by board and color.
 *
 * Counts represent pieces currently held in hand; captures on one board feed the
 * partner board's reserves for the opposing color.
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
