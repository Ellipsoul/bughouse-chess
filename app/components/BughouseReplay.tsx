"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCcw, SkipBack, SkipForward, StepBack, StepForward } from "lucide-react";
import ChessBoard from "./ChessBoard";
import MoveList from "./MoveList";
import PieceReserveVertical from "./PieceReserveVertical";
import { TooltipAnchor } from "./TooltipAnchor";
import { processGameData } from "../utils/moveOrdering";
import { BughouseReplayController } from "../utils/replayController";
import { BughouseGameState, BughousePlayer } from "../types/bughouse";
import { ChessGame } from "../actions";
import { getClockTintClasses, getTeamTimeDiffDeciseconds } from "../utils/clockAdvantage";
import type { BoardAnnotations } from "../utils/boardAnnotations";
import {
  createEmptyBoardAnnotationsByFen,
  getAnnotationsForFen,
  setAnnotationsForFen,
  toFenKey,
} from "../utils/boardAnnotationPersistence";

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
  const replayContainerRef = useRef<HTMLDivElement>(null);
  const boardsContainerRef = useRef<HTMLDivElement>(null);
  const controlsContainerRef = useRef<HTMLDivElement>(null);

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
   * Persist user board drawings (circles/arrows) per *board position* (FEN) per board.
   *
   * Replay navigation frequently advances only one board at a time; keying by per-board FEN
   * ensures drawings on the non-moving board remain visible while you step through moves.
   */
  const [annotationsByFen, setAnnotationsByFen] = useState(() => createEmptyBoardAnnotationsByFen());

  const boardAFenKey = toFenKey(gameState.boardA.fen);
  const boardBFenKey = toFenKey(gameState.boardB.fen);
  const boardAAnnotations = getAnnotationsForFen(annotationsByFen, "A", boardAFenKey);
  const boardBAnnotations = getAnnotationsForFen(annotationsByFen, "B", boardBFenKey);

  const handleBoardAAnnotationsChange = useCallback(
    (next: BoardAnnotations) => {
      setAnnotationsByFen((prev) => setAnnotationsForFen(prev, "A", boardAFenKey, next));
    },
    [boardAFenKey],
  );

  const handleBoardBAnnotationsChange = useCallback(
    (next: BoardAnnotations) => {
      setAnnotationsByFen((prev) => setAnnotationsForFen(prev, "B", boardBFenKey, next));
    },
    [boardBFenKey],
  );

  const lastMoveHighlightsByBoard = replayController.getLastMoveHighlightsByBoard();

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
  const NAME_BLOCK = 44; // player bar height (px, derived from styling)
  const COLUMN_PADDING = 12; // board column vertical padding (px, derived from styling)
  const BH_DESKTOP_MIN_WIDTH_PX = 1400;

  const [boardSize, setBoardSize] = useState(DEFAULT_BOARD_SIZE);

  useEffect(() => {
    const boardsContainer = boardsContainerRef.current;
    if (!boardsContainer) return;

    const computeBoardSize = () => {
      // Width-driven cap (always): reserve | boardA | boardB | reserve => 3 gaps
      const availableWidth =
        boardsContainer.clientWidth - (RESERVE_COLUMN_WIDTH_PX * 2 + GAP_PX * 3);
      const widthCandidate = Math.floor(availableWidth / 2);

      // Height-driven cap (stacked/tablet only): ensure we leave a reasonable amount of room
      // for the move list so the page doesn't need to scroll.
      let heightCap = DEFAULT_BOARD_SIZE;
      const isDesktop =
        typeof window !== "undefined" &&
        window.matchMedia(`(min-width: ${BH_DESKTOP_MIN_WIDTH_PX}px)`).matches;

      if (!isDesktop) {
        const containerHeight = replayContainerRef.current?.clientHeight ?? 0;
        const controlsHeight = controlsContainerRef.current?.clientHeight ?? 40;

        // Gap between boards and controls in the left column (`gap-4`).
        const GAP_BOARDS_CONTROLS_PX = 16;
        // Gap between the (stacked) sections: left column then move list (`gap-6`).
        const GAP_SECTIONS_PX = 24;
        // Keep enough move list height to be usable even on shorter tablet viewports.
        const MIN_MOVELIST_HEIGHT_PX = 220;

        if (containerHeight > 0) {
          const availablePlayAreaHeight =
            containerHeight -
            controlsHeight -
            GAP_BOARDS_CONTROLS_PX -
            GAP_SECTIONS_PX -
            MIN_MOVELIST_HEIGHT_PX;

          const maxBoardSizeFromHeight =
            availablePlayAreaHeight - NAME_BLOCK * 2 - COLUMN_PADDING * 2;

          if (Number.isFinite(maxBoardSizeFromHeight)) {
            heightCap = Math.floor(maxBoardSizeFromHeight);
          }
        }
      }

      const capped = Math.min(widthCandidate, heightCap);
      const nextSize = Math.max(MIN_BOARD_SIZE, Math.min(DEFAULT_BOARD_SIZE, capped));

      setBoardSize((prev) => (prev === nextSize ? prev : nextSize));
    };

    computeBoardSize();

    const resizeObserver = new ResizeObserver(() => computeBoardSize());
    resizeObserver.observe(boardsContainer);
    if (replayContainerRef.current) {
      resizeObserver.observe(replayContainerRef.current);
    }
    if (controlsContainerRef.current) {
      resizeObserver.observe(controlsContainerRef.current);
    }
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
    (player: BughousePlayer, clockValue: number | undefined, team: "AWhite_BBlack" | "ABlack_BWhite") => {
      const diffDeciseconds =
        gameState ? getTeamTimeDiffDeciseconds({ A: gameState.boardA.clocks, B: gameState.boardB.clocks }) : 0;
      const tint = getClockTintClasses({ diffDeciseconds, team });
      const neutral = "text-white/90";

      return (
      <div
        className="flex items-center justify-between w-full px-3 text-base lg:text-xl font-bold text-white tracking-wide"
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
            <span className="shrink-0 text-xs lg:text-sm font-semibold text-white/60">
              ({formatElo(player.rating)})
            </span>
          )}
        </div>
        <span
          className={[
            "font-mono text-base lg:text-lg tabular-nums rounded px-2 py-0.5 transition-colors",
            tint ?? neutral,
          ].join(" ")}
        >
          {formatClock(clockValue)}
        </span>
      </div>
      );
    },
    [boardSize, formatClock, formatElo, gameState],
  );

  return (
    <div
      ref={replayContainerRef}
      className="w-full mx-auto h-full min-h-0 min-w-0 flex overflow-hidden min-[1400px]:h-auto"
      style={
        {
          /**
           * CSS var used to align the move list height with the board play area in desktop mode.
           * We use a variable (instead of inline `height`) so responsive classes can override
           * height in stacked/tablet mode.
           */
          ["--bh-play-area-height" as never]: `${playAreaHeight}px`,
        } as React.CSSProperties
      }
    >
      <div className="flex flex-1 min-h-0 min-w-0 flex-col min-[1400px]:flex-row justify-center gap-6 items-center min-[1400px]:items-start">
        {/* Left Column: Boards + Controls */}
        <div className="flex flex-col items-center gap-4 min-w-0 w-full min-[1400px]:w-auto min-[1400px]:grow">
          {/* Boards Container with Reserves */}
          <div
            ref={boardsContainerRef}
            className="flex w-full gap-4 justify-center items-stretch min-w-0"
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
                    "AWhite_BBlack",
                  )
                : renderPlayerBar(
                    gameState.players.aBlack,
                    gameState.boardA.clocks.black,
                    "ABlack_BWhite",
                  )}
              <ChessBoard
                fen={gameState.boardA.fen}
                boardName="A"
                size={boardSize}
                flip={isBoardsFlipped}
                annotations={boardAAnnotations}
                onAnnotationsChange={handleBoardAAnnotationsChange}
                promotedSquares={gameState.promotedSquares.A}
                lastMoveFromSquare={
                  lastMoveHighlightsByBoard.A?.from ?? null
                }
                lastMoveToSquare={
                  lastMoveHighlightsByBoard.A?.to ?? null
                }
              />
              {isBoardsFlipped
                ? renderPlayerBar(
                    gameState.players.aBlack,
                    gameState.boardA.clocks.black,
                    "ABlack_BWhite",
                  )
                : renderPlayerBar(
                    gameState.players.aWhite,
                    gameState.boardA.clocks.white,
                    "AWhite_BBlack",
                  )}
            </div>

            {/* Board B - Black at bottom (flipped) */}
            <div className="flex flex-col items-center justify-between h-full py-2 gap-2">
              {isBoardsFlipped
                ? renderPlayerBar(
                    gameState.players.bBlack,
                    gameState.boardB.clocks.black,
                    "AWhite_BBlack",
                  )
                : renderPlayerBar(
                    gameState.players.bWhite,
                    gameState.boardB.clocks.white,
                    "ABlack_BWhite",
                  )}
              <ChessBoard
                fen={gameState.boardB.fen}
                boardName="B"
                size={boardSize}
                flip={!isBoardsFlipped}
                annotations={boardBAnnotations}
                onAnnotationsChange={handleBoardBAnnotationsChange}
                promotedSquares={gameState.promotedSquares.B}
                lastMoveFromSquare={
                  lastMoveHighlightsByBoard.B?.from ?? null
                }
                lastMoveToSquare={
                  lastMoveHighlightsByBoard.B?.to ?? null
                }
              />
              {isBoardsFlipped
                ? renderPlayerBar(
                    gameState.players.bWhite,
                    gameState.boardB.clocks.white,
                    "ABlack_BWhite",
                  )
                : renderPlayerBar(
                    gameState.players.bBlack,
                    gameState.boardB.clocks.black,
                    "AWhite_BBlack",
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
            ref={controlsContainerRef}
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
              content="Flip boards (f)"
              className="absolute right-1 bottom-0 inline-flex"
            >
              <button
                onClick={toggleBoardsFlipped}
                className={controlButtonBaseClass}
                aria-label="Flip boards"
                type="button"
              >
                <RefreshCcw aria-hidden className="h-5 w-5" />
              </button>
            </TooltipAnchor>
          </div>
        </div>

        {/* Right Column: Move List (slightly narrower to give boards more space) */}
        <div
          className={[
            // Stacked / tablet: full width under the boards, and consume remaining height.
            "w-full flex-1 min-h-0 min-w-0 overflow-x-hidden",
            // Desktop: fixed right column, height aligned to board play area.
            "min-[1400px]:flex-none min-[1400px]:shrink-0 min-[1400px]:w-[360px] min-[1400px]:h-(--bh-play-area-height))]",
          ].join(" ")}
        >
          <MoveList
            moves={replayController.getCombinedMoves()}
            moveDurations={replayController.getMoveDurations()}
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
