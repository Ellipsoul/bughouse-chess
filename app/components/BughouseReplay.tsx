"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlipVertical, SkipBack, SkipForward, StepBack, StepForward } from "lucide-react";
import ChessBoard from "./ChessBoard";
import MoveList from "./MoveList";
import PieceReserveVertical from "./PieceReserveVertical";
import { TooltipAnchor } from "./TooltipAnchor";
import { processGameData } from "../utils/moveOrdering";
import { BughouseReplayController } from "../utils/replayController";
import { BughouseGameState, BughousePlayer } from "../types/bughouse";
import { ChessGame } from "../actions";

interface BughouseReplayProps {
  gameData: {
    original: ChessGame;
    partner: ChessGame | null;
  };
}

/**
 * Visual replay experience for a two-board bughouse match, including boards,
 * reserves, clocks, and move navigation.
 */
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
  const [isBoardsFlipped, setIsBoardsFlipped] = useState(false);

  /**
   * Global board orientation toggle.
   *
   * This is the *single source of truth* for "user flipped or not" so every UI element
   * (boards, reserves, and player bars) stays consistent.
   */
  const toggleBoardsFlipped = useCallback(() => {
    setIsBoardsFlipped((prev) => !prev);
  }, []);

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

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const target = event.target;
      const isTypingTarget =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT");

      if (isTypingTarget) {
        return;
      }

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
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleBoardsFlipped();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleNextMove, handlePreviousMove, handleStart, handleEnd, toggleBoardsFlipped]);

  const controlButtonBaseClass =
    "h-10 w-10 flex items-center justify-center rounded-md bg-gray-800 text-gray-200 border border-gray-700 cursor-pointer " +
    "hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-600 disabled:border-gray-800 disabled:cursor-not-allowed " +
    "transition-colors";

  // Derive a consistent column height (board + two name blocks + small padding/gaps).
  const NAME_BLOCK = 44;
  const COLUMN_PADDING = 12;
  const playAreaHeight = boardSize + NAME_BLOCK * 2 + COLUMN_PADDING * 2;
  const reserveHeight = playAreaHeight;
  const controlsWidth =
    boardSize * 2 + RESERVE_COLUMN_WIDTH_PX * 2 + GAP_PX * 3;

  const formatClock = useCallback((deciseconds?: number) => {
    const safeValue =
      typeof deciseconds === "number" && Number.isFinite(deciseconds)
        ? Math.max(0, Math.floor(deciseconds))
        : 0;

    const minutes = Math.floor(safeValue / 600);
    const seconds = Math.floor((safeValue % 600) / 10);
    const tenths = safeValue % 10;

    return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
  }, []);

  const formatElo = useCallback((rating?: number) => {
    if (typeof rating !== "number" || !Number.isFinite(rating)) {
      return null;
    }

    return Math.round(rating).toString();
  }, []);

  const renderPlayerBar = useCallback(
    (player: BughousePlayer, clockValue?: number) => (
      <div
        className="flex items-center justify-between w-full px-3 text-xl font-bold text-white tracking-wide"
        style={{ width: boardSize }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="truncate min-w-0"
            title={
              formatElo(player.rating)
                ? `${player.username} (${formatElo(player.rating)})`
                : player.username
            }
          >
            {player.username}
          </span>
          {formatElo(player.rating) && (
            <span className="shrink-0 text-sm font-semibold text-white/60">
              ({formatElo(player.rating)})
            </span>
          )}
        </div>
        <span className="font-mono text-lg tabular-nums">
          {formatClock(clockValue)}
        </span>
      </div>
    ),
    [boardSize, formatClock, formatElo],
  );

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
            <div className="flex flex-col justify-start shrink-0 w-16 h-full">
              <PieceReserveVertical
                whiteReserves={pieceReserves.A.white}
                blackReserves={pieceReserves.A.black}
                bottomColor={isBoardsFlipped ? "black" : "white"}
                height={reserveHeight}
              />
            </div>

            {/* Board A - White at bottom */}
            <div className="flex flex-col items-center justify-between h-full py-2 gap-2">
              {isBoardsFlipped
                ? renderPlayerBar(
                    gameState.players.aWhite,
                    gameState.boardA.clocks.white,
                  )
                : renderPlayerBar(
                    gameState.players.aBlack,
                    gameState.boardA.clocks.black,
                  )}
              <ChessBoard
                fen={gameState.boardA.fen}
                boardName="A"
                size={boardSize}
                flip={isBoardsFlipped}
                promotedSquares={gameState.promotedSquares.A}
              />
              {isBoardsFlipped
                ? renderPlayerBar(
                    gameState.players.aBlack,
                    gameState.boardA.clocks.black,
                  )
                : renderPlayerBar(
                    gameState.players.aWhite,
                    gameState.boardA.clocks.white,
                  )}
            </div>

            {/* Board B - Black at bottom (flipped) */}
            <div className="flex flex-col items-center justify-between h-full py-2 gap-2">
              {isBoardsFlipped
                ? renderPlayerBar(
                    gameState.players.bBlack,
                    gameState.boardB.clocks.black,
                  )
                : renderPlayerBar(
                    gameState.players.bWhite,
                    gameState.boardB.clocks.white,
                  )}
              <ChessBoard
                fen={gameState.boardB.fen}
                boardName="B"
                size={boardSize}
                flip={!isBoardsFlipped}
                promotedSquares={gameState.promotedSquares.B}
              />
              {isBoardsFlipped
                ? renderPlayerBar(
                    gameState.players.bWhite,
                    gameState.boardB.clocks.white,
                  )
                : renderPlayerBar(
                    gameState.players.bBlack,
                    gameState.boardB.clocks.black,
                  )}
            </div>

            {/* Right Reserves (Board B) */}
            <div className="flex flex-col justify-start shrink-0 w-16 h-full">
              <PieceReserveVertical
                whiteReserves={pieceReserves.B.white}
                blackReserves={pieceReserves.B.black}
                bottomColor={isBoardsFlipped ? "white" : "black"}
                height={reserveHeight}
              />
            </div>
          </div>

          {/* Board Controls (centered under boards) */}
          <div
            className="relative flex items-center justify-center"
            style={{ width: controlsWidth }}
          >
            <div className="flex items-center gap-3">
              <TooltipAnchor content="Jump to start (↑)">
                <button
                  onClick={handleStart}
                  disabled={!replayController.canMoveBackward()}
                  className={controlButtonBaseClass}
                  aria-label="Jump to start"
                  type="button"
                >
                  <SkipBack aria-hidden className="h-5 w-5" />
                </button>
              </TooltipAnchor>
              <TooltipAnchor content="Previous move (←)">
                <button
                  onClick={handlePreviousMove}
                  disabled={!replayController.canMoveBackward()}
                  className={controlButtonBaseClass}
                  aria-label="Previous move"
                  type="button"
                >
                  <StepBack aria-hidden className="h-5 w-5" />
                </button>
              </TooltipAnchor>
              <TooltipAnchor content="Next move (→)">
                <button
                  onClick={handleNextMove}
                  disabled={!replayController.canMoveForward()}
                  className={controlButtonBaseClass}
                  aria-label="Next move"
                  type="button"
                >
                  <StepForward aria-hidden className="h-5 w-5" />
                </button>
              </TooltipAnchor>
              <TooltipAnchor content="Jump to end (↓)">
                <button
                  onClick={handleEnd}
                  disabled={!replayController.canMoveForward()}
                  className={controlButtonBaseClass}
                  aria-label="Jump to end"
                  type="button"
                >
                  <SkipForward aria-hidden className="h-5 w-5" />
                </button>
              </TooltipAnchor>
            </div>

            <TooltipAnchor
              content="Flip boards (F)"
              className="absolute right-1 bottom-0 inline-flex"
            >
              <button
                onClick={toggleBoardsFlipped}
                className={controlButtonBaseClass}
                aria-label="Flip boards"
                type="button"
              >
                <FlipVertical aria-hidden className="h-5 w-5" />
              </button>
            </TooltipAnchor>
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
