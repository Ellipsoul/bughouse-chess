// Move ordering system based on timestamps - adapted from bughouse-viewer
import { BughouseMove, ProcessedGameData } from '../types/bughouse';
import { ChessGame } from '../actions';
import { parseChessComCompressedMovelist } from '../chesscom_movelist_parse';

export function processGameData(originalGame: ChessGame, partnerGame: ChessGame | null): ProcessedGameData {
  const result: ProcessedGameData = {
    originalGame: {
      moves: [],
      timestamps: []
    },
    partnerGame: {
      moves: [],
      timestamps: []
    },
    combinedMoves: []
  };

  // Process original game
  if (originalGame.game.moveList) {
    result.originalGame.moves = parseMovesFromMoveList(originalGame.game.moveList);
  }
if (originalGame.game.moveTimestamps && originalGame.game.moveTimestamps.length) {
    result.originalGame.timestamps = originalGame.game.moveTimestamps.split(',').map(Number);
  }

  // Process partner game if available
  if (partnerGame && partnerGame.game.moveList) {
    result.partnerGame.moves = parseMovesFromMoveList(partnerGame.game.moveList);
  }
if (partnerGame && partnerGame.game.moveTimestamps && partnerGame.game.moveTimestamps.length) {
    result.partnerGame.timestamps = partnerGame.game.moveTimestamps.split(',').map(Number);
  }

  // Calculate move times and create combined move list
  result.combinedMoves = createCombinedMoveList(
    result.originalGame,
    result.partnerGame,
    originalGame.game.baseTime1 || 300,
    originalGame.game.timeIncrement1 || 0
  );

  return result;
}

function parseMovesFromMoveList(moveList: string): string[] {
  return parseChessComCompressedMovelist(moveList);
}

function createCombinedMoveList(
  gameA: { moves: string[]; timestamps: number[] },
  gameB: { moves: string[]; timestamps: number[] },
  initialTime: number,
  timeIncrement: number
): BughouseMove[] {
  // Adapted from getMoveOrder function in bughouse-viewer
  const movesA = calculateMoveTimes(gameA.timestamps, initialTime, timeIncrement);
  const movesB = calculateMoveTimes(gameB.timestamps, initialTime, timeIncrement);

  const combinedMoves: BughouseMove[] = [];
  let aIndex = 0;
  let bIndex = 0;

  // Merge moves based on timestamps
  while (aIndex < movesA.length || bIndex < movesB.length) {
    const aEmpty = aIndex >= movesA.length;
    const bEmpty = bIndex >= movesB.length;
    const bothNonEmpty = !aEmpty && !bEmpty;

    if ((bothNonEmpty && movesB[bIndex].timestamp < movesA[aIndex].timestamp) || aEmpty) {
      // Add move from board B
      combinedMoves.push({
        board: 'B',
        moveNumber: Math.floor(bIndex / 2) + 1,
        move: gameB.moves[bIndex] || '',
        timestamp: movesB[bIndex].timestamp,
        side: bIndex % 2 === 0 ? 'white' : 'black'
      });
      bIndex++;
    } else {
      // Add move from board A
      combinedMoves.push({
        board: 'A',
        moveNumber: Math.floor(aIndex / 2) + 1,
        move: gameA.moves[aIndex] || '',
        timestamp: movesA[aIndex].timestamp,
        side: aIndex % 2 === 0 ? 'white' : 'black'
      });
      aIndex++;
    }
  }

  return combinedMoves;
}

function calculateMoveTimes(timestamps: number[], initialTime: number, timeIncrement: number): Array<{ timestamp: number }> {
  // Adapted from getMoveTimes function in bughouse-viewer
  if (!timestamps.length) return [];

  const moveTimestamps: Array<{ timestamp: number }> = [];
  
  for (let i = 0; i < timestamps.length; i++) {
    const remainingTime = timestamps[i] - (timestamps[i - 1] || initialTime);
    const sumGivenTime = 2 * initialTime + (i + 1) * timeIncrement * 10;
    const moveTime = sumGivenTime - remainingTime;
    
    moveTimestamps.push({ timestamp: Math.max(0, moveTime) });
  }

  return moveTimestamps;
}
