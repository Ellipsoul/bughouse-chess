"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import ChessBoard from "./ChessBoard";
import { processGameData } from "../utils/moveOrdering";
import { BughouseReplayController } from "../utils/replayController";
import { BughouseGameState } from "../types/bughouse";

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

  const handleNextMove = useCallback(() => {
    if (replayController.moveForward()) {
      updateGameState();
    }
  }, [replayController]);

  const handlePreviousMove = useCallback(() => {
    if (replayController.moveBackward()) {
      updateGameState();
    }
  }, [replayController]);

  const currentMove = replayController.getCurrentMove();
  const totalMoves = replayController.getTotalMoves();

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNextMove();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePreviousMove();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleNextMove, handlePreviousMove]);

  // Helper to render piece reserves
  const renderReserves = (
    reserves: { [piece: string]: number },
    isWhite: boolean,
  ) => {
    const pieceTypes = ["p", "r", "n", "b", "q"];
    return pieceTypes.map((piece) => {
      const count = reserves[piece] || 0;
      return (
        <div
          key={piece}
          className={`relative inline-block m-1 ${
            count > 0 ? "opacity-100" : "opacity-30"
          }`}
        >
          <span
            className={`px-2 py-1 rounded text-sm ${
              isWhite
                ? "bg-white text-black"
                : "bg-gray-800 text-white border border-gray-400"
            }`}
          >
            {piece.toUpperCase()}
          </span>
          {count > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {count}
            </span>
          )}
        </div>
      );
    });
  };

  return (
    <div className="p-6 bg-gray-900 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">
          Bughouse Chess Replay
        </h1>

        {/* Move counter and controls */}
        <div className="flex flex-col items-center mb-6 space-y-2">
          <div className="flex justify-center items-center space-x-4">
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
          </div>
          <div className="text-gray-400 text-sm">
            Use ← → arrow keys to navigate
          </div>
        </div>

        {/* Current move display */}
        {currentMove && (
          <div className="text-center mb-4">
            <span className="text-white bg-gray-800 px-3 py-1 rounded">
              Current: Board {currentMove.board} - {currentMove.move}
              {currentMove.timestamp &&
                ` (${currentMove.timestamp.toFixed(3)}s)`}
            </span>
          </div>
        )}

        {/* Chess boards */}
        <div className="flex justify-center items-start space-x-8">
          {/* Board A - White at bottom */}
          <div className="flex flex-col items-center">
            <div className="mb-2 text-center">
              <h3 className="text-lg font-semibold text-white">Board A</h3>
              <p className="text-sm text-gray-400">
                {gameState.players.aBlack} (Black)
              </p>
            </div>
            <ChessBoard
              fen={gameState.boardA.fen}
              boardName="A"
              size={400}
              flip={false}
            />
            <div className="mt-2 text-center">
              <p className="text-sm text-gray-400">
                {gameState.players.aWhite} (White)
              </p>
            </div>

            {/* Board A Reserves */}
            <div className="mt-4 p-3 bg-gray-800 rounded-lg w-full">
              <h4 className="text-white font-semibold mb-2 text-center">
                Piece Reserves
              </h4>
              <div className="text-center">
                <div className="mb-2">
                  <span className="text-gray-300 text-sm">White:</span>
                  {renderReserves(pieceReserves.A.white, true)}
                </div>
                <div>
                  <span className="text-gray-300 text-sm">Black:</span>
                  {renderReserves(pieceReserves.A.black, false)}
                </div>
              </div>
            </div>
          </div>

          {/* Board B - Black at bottom (flipped) */}
          <div className="flex flex-col items-center">
            <div className="mb-2 text-center">
              <h3 className="text-lg font-semibold text-white">Board B</h3>
              <p className="text-sm text-gray-400">
                {gameState.players.bWhite} (White)
              </p>
            </div>
            <ChessBoard
              fen={gameState.boardB.fen}
              boardName="B"
              size={400}
              flip={true}
            />
            <div className="mt-2 text-center">
              <p className="text-sm text-gray-400">
                {gameState.players.bBlack} (Black)
              </p>
            </div>

            {/* Board B Reserves */}
            <div className="mt-4 p-3 bg-gray-800 rounded-lg w-full">
              <h4 className="text-white font-semibold mb-2 text-center">
                Piece Reserves
              </h4>
              <div className="text-center">
                <div className="mb-2">
                  <span className="text-gray-300 text-sm">White:</span>
                  {renderReserves(pieceReserves.B.white, true)}
                </div>
                <div>
                  <span className="text-gray-300 text-sm">Black:</span>
                  {renderReserves(pieceReserves.B.black, false)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Debug info */}
        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <h3 className="text-white font-semibold mb-2">BPGN & Timestamps</h3>
          <div className="text-gray-300 text-sm">
            <pre className="whitespace-pre-wrap overflow-x-auto">{replayController.getDebugInfo()}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BughouseReplay;
