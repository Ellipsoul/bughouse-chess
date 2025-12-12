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
  const boardColumnRef = useRef<HTMLDivElement>(null);

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
  const [playAreaHeight, setPlayAreaHeight] = useState<number>(
    DEFAULT_BOARD_SIZE + 120
  );

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

  useEffect(() => {
    const column = boardColumnRef.current;
    if (!column) return;

    const computeHeight = () => {
      const nextHeight = Math.ceil(column.getBoundingClientRect().height);
      if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
      setPlayAreaHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    computeHeight();

    const resizeObserver = new ResizeObserver(() => computeHeight());
    resizeObserver.observe(column);
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

  const controlButtonBaseClass =
    "h-10 w-10 flex items-center justify-center rounded-md bg-gray-800 text-gray-200 border border-gray-700 " +
    "hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-600 disabled:border-gray-800 disabled:cursor-not-allowed " +
    "transition-colors";

  // Give reserves a little breathing room below full column height.
  const reserveHeight = Math.max(300, playAreaHeight - 24);

  return (
    <div className="w-full mx-auto">
      <div className="flex justify-center gap-6 items-start">
        {/* Left Column: Boards + Controls */}
        <div className="flex flex-col items-center gap-4 grow min-w-0">
          {/* Boards Container with Reserves */}
          <div
            ref={boardsContainerRef}
            className="flex gap-4 justify-center items-stretch min-w-0"
            style={{ height: playAreaHeight }}
          >
            {/* Left Reserves (Board A) */}
            <div className="flex flex-col justify-center shrink-0 w-16">
              <PieceReserveVertical
                whiteReserves={pieceReserves.A.white}
                blackReserves={pieceReserves.A.black}
                bottomColor="white"
                height={reserveHeight}
              />
            </div>

            {/* Board A - White at bottom */}
            <div ref={boardColumnRef} className="flex flex-col items-center">
              <div className="mb-3 text-center">
                <div className="text-xl font-bold text-white tracking-wide">
                  {gameState.players.aBlack}
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
              </div>
            </div>

            {/* Board B - Black at bottom (flipped) */}
            <div className="flex flex-col items-center">
              <div className="mb-3 text-center">
                <div className="text-xl font-bold text-white tracking-wide">
                  {gameState.players.bWhite}
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
              </div>
            </div>

            {/* Right Reserves (Board B) */}
            <div className="flex flex-col justify-center shrink-0 w-16">
              <PieceReserveVertical
                whiteReserves={pieceReserves.B.white}
                blackReserves={pieceReserves.B.black}
                bottomColor="black"
                height={reserveHeight}
              />
            </div>
          </div>

          {/* Board Controls (centered under boards) */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleStart}
              disabled={!replayController.canMoveBackward()}
              className={controlButtonBaseClass}
              title="Start"
              aria-label="Jump to start"
              type="button"
            >
              <span className="text-lg leading-none">«</span>
            </button>
            <button
              onClick={handlePreviousMove}
              disabled={!replayController.canMoveBackward()}
              className={controlButtonBaseClass}
              title="Previous"
              aria-label="Previous move"
              type="button"
            >
              <span className="text-lg leading-none">‹</span>
            </button>
            <button
              onClick={handleNextMove}
              disabled={!replayController.canMoveForward()}
              className={controlButtonBaseClass}
              title="Next"
              aria-label="Next move"
              type="button"
            >
              <span className="text-lg leading-none">›</span>
            </button>
            <button
              onClick={handleEnd}
              disabled={!replayController.canMoveForward()}
              className={controlButtonBaseClass}
              title="End"
              aria-label="Jump to end"
              type="button"
            >
              <span className="text-lg leading-none">»</span>
            </button>
          </div>
        </div>

        {/* Right Column: Move List (slightly narrower to give boards more space) */}
        <div
          className="shrink-0 w-[320px] md:w-[340px] lg:w-[360px]"
          style={{ height: playAreaHeight }}
        >
          <MoveList
            moves={replayController.getCombinedMoves()}
            currentMoveIndex={currentMoveIndex}
            players={gameState.players}
            onMoveClick={handleJumpToMove}
          />
        </div>
      </div>
    </div>
  );
};

export default BughouseReplay;
