"use client";

import React, { useEffect, useState, useMemo } from 'react';
import ChessBoard from './ChessBoard';
import { processGameData } from '../utils/moveOrdering';
import { BughouseReplayController } from '../utils/replayController';
import { BughouseGameState } from '../types/bughouse';

interface BughouseReplayProps {
  gameData: any; // The processed game data from Chess.com
}

const BughouseReplay: React.FC<BughouseReplayProps> = ({ gameData }) => {
  // Create the replay controller
  const replayController = useMemo(() => {
    const processedData = processGameData(gameData.original, gameData.partner);
    return new BughouseReplayController(processedData);
  }, [gameData]);

  const [gameState, setGameState] = useState<BughouseGameState>(() => 
    replayController.getCurrentGameState()
  );
  const [pieceReserves, setPieceReserves] = useState(() => 
    replayController.getCurrentPieceReserves()
  );
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);

  // Update state when moves change
  const updateGameState = () => {
    setGameState(replayController.getCurrentGameState());
    setPieceReserves(replayController.getCurrentPieceReserves());
    setCurrentMoveIndex(replayController.getCurrentMoveIndex());
  };

  const handleNextMove = () => {
    if (replayController.moveForward()) {
      updateGameState();
    }
  };

  const handlePreviousMove = () => {
    if (replayController.moveBackward()) {
      updateGameState();
    }
  };

  const handleReset = () => {
    replayController.reset();
    updateGameState();
  };

  const currentMove = replayController.getCurrentMove();
  const totalMoves = replayController.getTotalMoves();

  return (
    <div className="p-6 bg-gray-900 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">Bughouse Chess Replay</h1>
        
        {/* Move counter and controls */}
        <div className="flex justify-center items-center mb-6 space-x-4">
          <button 
            onClick={handlePreviousMove} 
            disabled={!replayController.canMoveBackward()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          
          <div className="text-white text-lg font-semibold">
            Move {currentMoveIndex} / {totalMoves}
          </div>
          
          <button 
            onClick={handleNextMove} 
            disabled={!replayController.canMoveForward()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            Next →
          </button>
          
          <button 
            onClick={handleReset}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reset
          </button>
        </div>

        {/* Current move display */}
        {currentMove && (
          <div className="text-center mb-4">
            <span className="text-white bg-gray-800 px-3 py-1 rounded">
              Current: Board {currentMove.board} - {currentMove.move} 
              {currentMove.timestamp && `(${currentMove.timestamp}s)`}
            </span>
          </div>
        )}

        {/* Chess boards */}
        <div className="flex justify-center items-start space-x-8">
          {/* Board A - White at bottom */}
          <div className="flex flex-col items-center">
            <div className="mb-2 text-center">
              <h3 className="text-lg font-semibold text-white">Board A</h3>
              <p className="text-sm text-gray-400">White at bottom</p>
            </div>
            <ChessBoard 
              fen={gameState.boardA.fen} 
              boardName="A" 
              size={400}
              flip={false}
            />
            <div className="mt-4 p-3 bg-gray-800 rounded-lg">
              <h3 className="text-white font-semibold mb-2">Reserves (Board A)</h3>
              <div className="text-gray-300">
                {pieceReserves.A.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {pieceReserves.A.map((piece, idx) => (
                      <span key={idx} className="bg-gray-700 px-2 py-1 rounded text-sm">
                        {piece.toUpperCase()}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-500">No pieces</span>
                )}
              </div>
            </div>
          </div>

          {/* Board B - Black at bottom (flipped) */}
          <div className="flex flex-col items-center">
            <div className="mb-2 text-center">
              <h3 className="text-lg font-semibold text-white">Board B</h3>
              <p className="text-sm text-gray-400">Black at bottom</p>
            </div>
            <ChessBoard 
              fen={gameState.boardB.fen} 
              boardName="B" 
              size={400}
              flip={true}
            />
            <div className="mt-4 p-3 bg-gray-800 rounded-lg">
              <h3 className="text-white font-semibold mb-2">Reserves (Board B)</h3>
              <div className="text-gray-300">
                {pieceReserves.B.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {pieceReserves.B.map((piece, idx) => (
                      <span key={idx} className="bg-gray-700 px-2 py-1 rounded text-sm">
                        {piece.toUpperCase()}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-500">No pieces</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Debug info */}
        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <h3 className="text-white font-semibold mb-2">Debug Info</h3>
          <div className="text-gray-300 text-sm">
            <p>Board A Moves: {gameState.boardA.moves.length}</p>
            <p>Board B Moves: {gameState.boardB.moves.length}</p>
            <p>Total Combined Moves: {totalMoves}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BughouseReplay;

