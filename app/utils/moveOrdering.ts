/**
 * Bughouse move ordering + timeline normalization.
 *
 * This module takes **two chess.com bughouse boards** (A + B) and produces a single,
 * interleaved move timeline ordered by time so the UI can replay the match as it
 * unfolded.
 *
 * Key constraints/quirks from chess.com payloads:
 * - Moves arrive as a compressed movelist string (see `parseChessComCompressedMoveList`).
 * - Per-board timing is represented via `moveTimestamps`, which in bughouse are expressed
 *   in **deciseconds** (tenths of a second) and represent the mover's remaining time.
 * - Timestamps are not always perfectly aligned with the number of moves, so we defensively
 *   clamp/truncate.
 *
 * Implementation note:
 * This file is adapted from the open-source "bughouse-viewer" move ordering logic,
 * with additional normalization to match our bughouse-specific SAN conventions.
 */
import { BughouseMove, ProcessedGameData } from "../types/bughouse";
import { ChessGame } from "../actions";
import { parseChessComCompressedMoveList } from "../chesscom_movelist_parse";

/**
 * chess.com exposes bughouse player identities as "top" and "bottom" *plus* an explicit `color`.
 * The "top/bottom" seating can vary depending on the viewer context, so we must derive
 * White/Black by the provided `color` field rather than assuming a fixed mapping.
 */
function normalizeChessTitle(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const normalized = raw.trim().toUpperCase();
  return normalized ? normalized : undefined;
}

function getPlayersByColor(game: ChessGame | null | undefined): {
  white: { username: string; rating: number; chessTitle?: string } | null;
  black: { username: string; rating: number; chessTitle?: string } | null;
} {
  if (!game) return { white: null, black: null };

  const top = game.players.top;
  const bottom = game.players.bottom;

  const normalizedTopColor = String(top.color || "").toLowerCase();
  const normalizedBottomColor = String(bottom.color || "").toLowerCase();

  const asPlayer = (p: { username: string; rating: number; chessTitle?: string }) => ({
    username: p.username || "Unknown",
    rating: p.rating,
    chessTitle: normalizeChessTitle(p.chessTitle),
  });

  if (normalizedTopColor === "white") {
    return { white: asPlayer(top), black: asPlayer(bottom) };
  }
  if (normalizedTopColor === "black") {
    return { white: asPlayer(bottom), black: asPlayer(top) };
  }

  // Fallback: sometimes the `color` field may be missing/empty in unexpected payloads.
  // In that case, we preserve the legacy assumption (top=white, bottom=black) so the UI
  // remains usable, but we still surface a warning in dev.
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[processGameData] Unexpected player colors from chess.com payload:",
      { top: normalizedTopColor, bottom: normalizedBottomColor },
    );
  }
  return { white: asPlayer(top), black: asPlayer(bottom) };
}

/**
 * Normalize two chess.com game payloads into a combined bughouse move timeline.
 * Timestamps are converted to deciseconds so boards can be merged chronologically.
 */
export function processGameData(
  originalGame: ChessGame,
  partnerGame: ChessGame | null,
): ProcessedGameData {
  const initialTime = originalGame.game.baseTime1 || 300;
  const timeIncrement = originalGame.game.timeIncrement1 || 0;

  const originalPlayers = getPlayersByColor(originalGame);
  const partnerPlayers = getPlayersByColor(partnerGame);

  const result: ProcessedGameData = {
    originalGame: {
      moves: [],
      timestamps: [],
    },
    partnerGame: {
      moves: [],
      timestamps: [],
    },
    combinedMoves: [],
    players: {
      aWhite: {
        username: originalPlayers.white?.username || "Unknown",
        rating: originalPlayers.white?.rating,
        chessTitle: originalPlayers.white?.chessTitle,
      },
      aBlack: {
        username: originalPlayers.black?.username || "Unknown",
        rating: originalPlayers.black?.rating,
        chessTitle: originalPlayers.black?.chessTitle,
      },
      bWhite: {
        username: partnerPlayers.white?.username || "Unknown",
        rating: partnerPlayers.white?.rating,
        chessTitle: partnerPlayers.white?.chessTitle,
      },
      bBlack: {
        username: partnerPlayers.black?.username || "Unknown",
        rating: partnerPlayers.black?.rating,
        chessTitle: partnerPlayers.black?.chessTitle,
      },
    },
    initialTime,
    timeIncrement,
  };

  if (process.env.NODE_ENV !== "production") {
    // Small sanity check to catch accidental regressions: by construction, `aWhite/aBlack`
    // and `bWhite/bBlack` should be derived from the `color` field whenever it exists.
    const ogTopColor = String(originalGame.players.top.color || "").toLowerCase();
    const ogBottomColor = String(originalGame.players.bottom.color || "").toLowerCase();
    if (ogTopColor === "black" && result.players.aWhite.username === originalGame.players.top.username) {
      console.warn("[processGameData] Potential player-color inversion detected for board A.");
    }
    if (ogBottomColor === "white" && result.players.aBlack.username === originalGame.players.bottom.username) {
      console.warn("[processGameData] Potential player-color inversion detected for board A.");
    }
  }

  // Process original game
  if (originalGame.game.moveList) {
    result.originalGame.moves = parseMovesFromMoveList(
      originalGame.game.moveList,
    );
  }
  if (
    originalGame.game.moveTimestamps && originalGame.game.moveTimestamps.length
  ) {
    result.originalGame.timestamps = originalGame.game.moveTimestamps.split(",")
      .map(Number);
  }

  // Process partner game if available
  if (partnerGame && partnerGame.game.moveList) {
    result.partnerGame.moves = parseMovesFromMoveList(
      partnerGame.game.moveList,
    );
  }
  if (
    partnerGame && partnerGame.game.moveTimestamps &&
    partnerGame.game.moveTimestamps.length
  ) {
    result.partnerGame.timestamps = partnerGame.game.moveTimestamps.split(",")
      .map(Number);
  }

  // Calculate move times and create combined move list
  // BaseTime1 and moveTimestamps appear to be in the same unit (likely deciseconds for Bughouse)
  // so we don't need to scale BaseTime1.
  result.combinedMoves = createCombinedMoveList(
    result.originalGame,
    result.partnerGame,
    initialTime,
    timeIncrement,
  );

  return result;
}

function parseMovesFromMoveList(moveList: string): string[] {
  return parseChessComCompressedMoveList(moveList);
}

/**
 * Merge two boards' moves based on timestamps so the UI can replay them in order.
 */
function createCombinedMoveList(
  gameA: { moves: string[]; timestamps: number[] },
  gameB: { moves: string[]; timestamps: number[] },
  initialTime: number,
  timeIncrement: number,
): BughouseMove[] {
  // Adapted from getMoveOrder function in bughouse-viewer
  let movesA = calculateMoveTimes(
    gameA.timestamps,
    initialTime,
    timeIncrement
  );
  let movesB = calculateMoveTimes(
    gameB.timestamps,
    initialTime,
    timeIncrement
  );

  // Truncate timestamp arrays to match the number of moves
  // This handles the case where the API returns more timestamps than moves
  if (movesA.length > gameA.moves.length) {
    movesA = movesA.slice(0, gameA.moves.length);
  }
  if (movesB.length > gameB.moves.length) {
    movesB = movesB.slice(0, gameB.moves.length);
  }

  const combinedMoves: BughouseMove[] = [];
  let aIndex = 0;
  let bIndex = 0;

  /**
   * Merge moves based on timestamps.
   *
   * Tie-breaking:
   * If two moves have the same computed timestamp we currently prefer board A first.
   * This is inherently ambiguous in real bughouse (simultaneous moves), so downstream
   * logic that cares about strict legality should still be prepared to reorder adjacent
   * same-timestamp cross-board moves (see `reorderSimultaneousCheckmateMove`).
   */
  while (aIndex < movesA.length || bIndex < movesB.length) {
    const aEmpty = aIndex >= movesA.length;
    const bEmpty = bIndex >= movesB.length;
    const bothNonEmpty = !aEmpty && !bEmpty;

    if (
      (bothNonEmpty && movesB[bIndex].timestamp < movesA[aIndex].timestamp) ||
      aEmpty
    ) {
      // Add move from board B
      combinedMoves.push({
        board: "B",
        moveNumber: Math.floor(bIndex / 2) + 1,
        move: gameB.moves[bIndex] || "",
        timestamp: movesB[bIndex].timestamp,
        side: bIndex % 2 === 0 ? "white" : "black",
      });
      bIndex++;
    } else {
      // Add move from board A
      combinedMoves.push({
        board: "A",
        moveNumber: Math.floor(aIndex / 2) + 1,
        move: gameA.moves[aIndex] || "",
        timestamp: movesA[aIndex].timestamp,
        side: aIndex % 2 === 0 ? "white" : "black",
      });
      aIndex++;
    }
  }

  return combinedMoves;
}

function calculateMoveTimes(
  timestamps: number[],
  initialTime: number,
  timeIncrement: number
): Array<{ timestamp: number }> {
  /**
   * Convert chess.com's per-move "remaining time" series into an **elapsed time** series.
   *
   * chess.com encodes `moveTimestamps` in a bughouse game as: after each ply, the mover's
   * remaining clock time (deciseconds). To interleave two boards we want a monotonic-ish
   * "time since start" for each ply.
   *
   * The trick (from bughouse-viewer) is that in bughouse the two clocks on a board are
   * effectively a "shared bucket" over the match:
   * - `remainingTime` at ply i can be approximated as (mover remaining) + (opponent remaining).
   * - `sumGivenTime` at ply i is \(2 * initial + increments\) (in deciseconds).
   * - elapsed = given - remaining.
   *
   * Units:
   * - `initialTime` from chess.com is in seconds.
   * - `timeIncrement` is in seconds.
   * - `timestamps[]` values are in deciseconds.
   * - Therefore we multiply increments by 10 to express everything in deciseconds.
   */
  if (!timestamps.length) return [];

  const moveTimestamps: Array<{ timestamp: number }> = [];

  for (let i = 0; i < timestamps.length; i++) {
    // remainingTime is the sum of both clocks at the time of the move.
    // timestamps[i] is the mover's remaining time.
    // timestamps[i-1] (or initialTime) is the opponent's remaining time.
    const prevTimestamp = i === 0 ? initialTime : timestamps[i - 1];
    const remainingTime = timestamps[i] + prevTimestamp;

    // sumGivenTime is the total time available on the board (initial * 2 + increments)
    const sumGivenTime = 2 * initialTime + (i + 1) * timeIncrement * 10;

    // Elapsed time is Total Available - Total Remaining
    const moveTime = sumGivenTime - remainingTime;

    moveTimestamps.push({ timestamp: Math.max(0, moveTime) });
  }

  return moveTimestamps;
}
