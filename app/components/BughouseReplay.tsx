"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChessBoard from "./ChessBoard";
import MoveList from "./MoveList";
import PieceReserveVertical from "./PieceReserveVertical";
import { processGameData } from "../utils/moveOrdering";
import { BughouseReplayController } from "../utils/replayController";
import { BughouseGameState } from "../types/bughouse";
import { ChessGame } from "../actions";

interface BughouseReplayProps {
  gameData: {
    original: ChessGame;
    partner: ChessGame | null;
  };
}

const BughouseReplay: React.FC<BughouseReplayProps> = ({ gameData }) => {
  const boardsContainerRef = useRef<HTMLDivElement>(null);

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

  /**
   * Keep the reserve columns a consistent, readable size and instead shrink boards
   * as the viewport narrows.
   *
   * We derive the board size from the available width of the boards container.
   */
  const DEFAULT_BOARD_SIZE = 400;
  const MIN_BOARD_SIZE = 260;
  const RESERVE_COLUMN_WIDTH_PX = 64; // Tailwind `w-16`
  const GAP_PX = 16; // Tailwind `gap-4`

  const [boardSize, setBoardSize] = useState(DEFAULT_BOARD_SIZE);

  useEffect(() => {
    const container = boardsContainerRef.current;
    if (!container) return;

    const computeBoardSize = () => {
      // children: reserve | boardA | boardB | reserve => 3 gaps
      const availableWidth =
        container.clientWidth - (RESERVE_COLUMN_WIDTH_PX * 2 + GAP_PX * 3);

      const candidate = Math.floor(availableWidth / 2);
      const nextSize = Math.max(
        MIN_BOARD_SIZE,
        Math.min(DEFAULT_BOARD_SIZE, candidate)
      );

      setBoardSize((prev) => (prev === nextSize ? prev : nextSize));
    };

    computeBoardSize();

    const resizeObserver = new ResizeObserver(() => computeBoardSize());
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Update state when moves change
  const updateGameState = useCallback(() => {
    setGameState(replayController.getCurrentGameState());
    setPieceReserves(replayController.getCurrentPieceReserves());
    setCurrentMoveIndex(replayController.getCurrentMoveIndex());
  }, [replayController]);

  const handleNextMove = useCallback(() => {
    if (replayController.moveForward()) {
      updateGameState();
    }
  }, [replayController, updateGameState]);

  const handlePreviousMove = useCallback(() => {
    if (replayController.moveBackward()) {
      updateGameState();
    }
  }, [replayController, updateGameState]);

  const handleStart = useCallback(() => {
    if (replayController.jumpToMove(-1)) {
      updateGameState();
    }
  }, [replayController, updateGameState]);

  const handleEnd = useCallback(() => {
    if (replayController.jumpToMove(replayController.getTotalMoves() - 1)) {
      updateGameState();
    }
  }, [replayController, updateGameState]);

  const handleJumpToMove = useCallback((index: number) => {
    if (replayController.jumpToMove(index)) {
      updateGameState();
    }
  }, [replayController, updateGameState]);

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
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        handleStart();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        handleEnd();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleNextMove, handlePreviousMove, handleStart, handleEnd]);

  return (
    <div className="w-full mx-auto">
      <div className="flex justify-center gap-8 h-[600px]">
        {/* Boards Container with Reserves */}
        <div
          ref={boardsContainerRef}
          className="flex gap-4 grow justify-center items-center min-w-0"
        >
          {/* Left Reserves (Board A) */}
          <div className="flex flex-col justify-center shrink-0 w-16">
            <PieceReserveVertical
              whiteReserves={pieceReserves.A.white}
              blackReserves={pieceReserves.A.black}
              bottomColor="white"
              height={boardSize}
            />
          </div>

          {/* Board A - White at bottom */}
          <div className="flex flex-col items-center">
            <div className="mb-3 text-center">
              <div className="text-xl font-bold text-white tracking-wide">
                {gameState.players.aBlack}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                Black
              </div>
            </div>
            <ChessBoard
              fen={gameState.boardA.fen}
              boardName="A"
              size={boardSize}
              flip={false}
            />
            <div className="mt-3 text-center">
              <div className="text-xl font-bold text-white tracking-wide">
                {gameState.players.aWhite}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                White
              </div>
            </div>
          </div>

          {/* Board B - Black at bottom (flipped) */}
          <div className="flex flex-col items-center">
            <div className="mb-3 text-center">
              <div className="text-xl font-bold text-white tracking-wide">
                {gameState.players.bWhite}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                White
              </div>
            </div>
            <ChessBoard
              fen={gameState.boardB.fen}
              boardName="B"
              size={boardSize}
              flip={true}
            />
            <div className="mt-3 text-center">
              <div className="text-xl font-bold text-white tracking-wide">
                {gameState.players.bBlack}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                Black
              </div>
            </div>
          </div>

          {/* Right Reserves (Board B) */}
          <div className="flex flex-col justify-center shrink-0 w-16">
            <PieceReserveVertical
              whiteReserves={pieceReserves.B.white}
              blackReserves={pieceReserves.B.black}
              bottomColor="black"
              height={boardSize}
            />
          </div>
        </div>

        {/* Move List */}
        <div className="flex-1 min-w-[350px] max-w-[25%]">
          <MoveList
            moves={replayController.getCombinedMoves()}
            currentMoveIndex={currentMoveIndex}
            players={gameState.players}
            onMoveClick={handleJumpToMove}
          />
        </div>
      </div>

      {/* Board Controls */}
      <div className="mt-8 flex flex-col items-center space-y-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleStart}
              disabled={!replayController.canMoveBackward()}
              className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
              title="Start of game"
            >
              |&lt;&lt;
            </button>
            <button
              onClick={handlePreviousMove}
              disabled={!replayController.canMoveBackward()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-900/20"
              title="Previous move"
            >
              &larr; Previous
            </button>

            <div className="text-white font-mono px-4">
              {currentMoveIndex + 1} / {totalMoves}
            </div>

            <button
              onClick={handleNextMove}
              disabled={!replayController.canMoveForward()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-900/20"
              title="Next move"
            >
              Next &rarr;
            </button>
            <button
              onClick={handleEnd}
              disabled={!replayController.canMoveForward()}
              className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
              title="End of game"
            >
              &gt;&gt;|
            </button>
          </div>
          <div className="text-gray-500 text-sm">
            Use arrow keys to navigate (Up/Down for Start/End)
          </div>
        </div>
    </div>
  );
};

export default BughouseReplay;
