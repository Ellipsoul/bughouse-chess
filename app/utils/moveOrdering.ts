// Move ordering system based on timestamps - adapted from bughouse-viewer
import { BughouseMove, ProcessedGameData } from "../types/bughouse";
import { ChessGame } from "../actions";
import { parseChessComCompressedMoveList } from "../chesscom_movelist_parse";

export function processGameData(
  originalGame: ChessGame,
  partnerGame: ChessGame | null,
): ProcessedGameData {
  const initialTime = originalGame.game.baseTime1 || 300;
  const timeIncrement = originalGame.game.timeIncrement1 || 0;

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
      aWhite: originalGame.players.top.username || "Unknown",
      aBlack: originalGame.players.bottom.username || "Unknown",
      bWhite: partnerGame?.players.top.username || "Unknown",
      bBlack: partnerGame?.players.bottom.username || "Unknown",
    },
    initialTime,
    timeIncrement,
  };

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

  // Merge moves based on timestamps
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
  // Adapted from getMoveTimes function in bughouse-viewer
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
