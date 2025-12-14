"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import {
  FlipVertical,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
} from "lucide-react";
import toast from "react-hot-toast";
import type { ChessGame } from "../actions";
import { processGameData } from "../utils/moveOrdering";
import type { BughousePlayer } from "../types/bughouse";
import ChessBoard from "./ChessBoard";
import PieceReserveVertical from "./PieceReserveVertical";
import { useAnalysisState } from "./useAnalysisState";
import VariationSelector from "./VariationSelector";
import PromotionPicker from "./PromotionPicker";
import MoveListWithVariations from "./MoveListWithVariations";

interface BughouseAnalysisProps {
  gameData?: {
    original: ChessGame;
    partner: ChessGame | null;
  } | null;
  isLoading?: boolean;
  /**
   * Notifies the parent whether the analysis tree has any moves/variations.
   * Used to warn before overwriting analysis by loading another game.
   */
  onAnalysisDirtyChange?: (dirty: boolean) => void;
}

const PLACEHOLDER_PLAYERS: {
  aWhite: BughousePlayer;
  aBlack: BughousePlayer;
  bWhite: BughousePlayer;
  bBlack: BughousePlayer;
} = {
  aWhite: { username: "White (A)" },
  aBlack: { username: "Black (A)" },
  bWhite: { username: "White (B)" },
  bBlack: { username: "Black (B)" },
};

/**
 * Interactive analysis experience for a two-board bughouse position:
 * - always renders both boards from first paint (start position when no game loaded)
 * - supports move entry + drops + nested variations (wired via analysis store)
 */
const BughouseAnalysis: React.FC<BughouseAnalysisProps> = ({
  gameData,
  isLoading,
  onAnalysisDirtyChange,
}) => {
  const boardsContainerRef = useRef<HTMLDivElement>(null);
  const {
    state,
    currentPosition,
    selectNode,
    navBack,
    navForwardOrOpenSelector,
    loadGameMainline,
    promoteVariationOneLevel,
    truncateAfterNode,
    closeVariationSelector,
    moveVariationSelectorIndex,
    setVariationSelectorIndex,
    acceptVariationSelector,
    tryApplyMove,
    setPendingDrop,
    commitPromotion,
    cancelPendingPromotion,
  } = useAnalysisState();

  const [isBoardsFlipped, setIsBoardsFlipped] = useState(false);

  const toggleBoardsFlipped = useCallback(() => {
    setIsBoardsFlipped((prev) => !prev);
  }, []);

  // Responsive board sizing (same approach as the replay UI).
  const DEFAULT_BOARD_SIZE = 400;
  const MIN_BOARD_SIZE = 260;
  const RESERVE_COLUMN_WIDTH_PX = 64; // Tailwind `w-16`
  const GAP_PX = 16; // Tailwind `gap-4`
  const [boardSize, setBoardSize] = useState(DEFAULT_BOARD_SIZE);

  useEffect(() => {
    const container = boardsContainerRef.current;
    if (!container) return;

    const computeBoardSize = () => {
      const availableWidth =
        container.clientWidth - (RESERVE_COLUMN_WIDTH_PX * 2 + GAP_PX * 3);
      const candidate = Math.floor(availableWidth / 2);
      const nextSize = Math.max(MIN_BOARD_SIZE, Math.min(DEFAULT_BOARD_SIZE, candidate));
      setBoardSize((prev) => (prev === nextSize ? prev : nextSize));
    };

    computeBoardSize();
    const resizeObserver = new ResizeObserver(() => computeBoardSize());
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const processedGame = useMemo(() => {
    if (!gameData) return null;
    return processGameData(gameData.original, gameData.partner);
  }, [gameData]);

  const players = processedGame?.players ?? PLACEHOLDER_PLAYERS;
  const shouldRenderClocks = Boolean(processedGame);

  // Report whether the analysis contains any moves (tree has nodes beyond root).
  const lastDirtyRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!onAnalysisDirtyChange) return;
    const dirty = Object.keys(state.tree.nodesById).length > 1;
    if (lastDirtyRef.current === dirty) return;
    lastDirtyRef.current = dirty;
    onAnalysisDirtyChange(dirty);
  }, [onAnalysisDirtyChange, state.tree.nodesById]);

  // When a game is loaded, override the current analysis tree with its mainline.
  const lastLoadedGameIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!processedGame) {
      lastLoadedGameIdRef.current = null;
      return;
    }

    const gameId = gameData?.original?.game?.id?.toString() ?? null;
    if (!gameId || lastLoadedGameIdRef.current === gameId) {
      return;
    }
    lastLoadedGameIdRef.current = gameId;

    const result = loadGameMainline(processedGame.combinedMoves);
    if (!result.ok) {
      toast.error(result.message);
    }
  }, [gameData, loadGameMainline, processedGame]);

  // Keyboard navigation: left/right move through the currently selected line,
  // opening the branch selector when needed. Up/down jump to start/end.
  // (Variation selector keyboard is implemented when that UI is mounted.)
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const target = event.target;
      const isTypingTarget =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT");
      if (isTypingTarget) return;

      // Promotion modal takes precedence over all navigation.
      if (state.pendingPromotion) {
        if (event.key === "Escape") {
          event.preventDefault();
          cancelPendingPromotion();
        }
        return;
      }

      // When the variation selector is open, it captures navigation keys.
      if (state.variationSelector?.open) {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          moveVariationSelectorIndex(-1);
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          moveVariationSelectorIndex(1);
          return;
        }
        if (event.key === "ArrowRight" || event.key === "Enter") {
          event.preventDefault();
          acceptVariationSelector();
          return;
        }
        if (event.key === "ArrowLeft" || event.key === "Escape") {
          event.preventDefault();
          closeVariationSelector();
          return;
        }
        return;
      }

      if (event.key === "Escape") {
        if (state.pendingDrop) {
          event.preventDefault();
          setPendingDrop(null);
        }
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        navForwardOrOpenSelector();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        navBack();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        selectNode(state.tree.rootId);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        // Jump to the end of the current mainline starting from the cursor.
        let nodeId = state.cursorNodeId;
        while (true) {
          const node = state.tree.nodesById[nodeId];
          if (!node?.mainChildId) break;
          nodeId = node.mainChildId;
        }
        selectNode(nodeId);
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleBoardsFlipped();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [
    acceptVariationSelector,
    closeVariationSelector,
    cancelPendingPromotion,
    commitPromotion,
    moveVariationSelectorIndex,
    navBack,
    navForwardOrOpenSelector,
    selectNode,
    setPendingDrop,
    state.cursorNodeId,
    state.pendingDrop,
    state.pendingPromotion,
    state.tree,
    state.variationSelector?.open,
    toggleBoardsFlipped,
  ]);

  const controlButtonBaseClass =
    "h-10 w-10 flex items-center justify-center rounded-md bg-gray-800 text-gray-200 border border-gray-700 cursor-pointer " +
    "hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-600 disabled:border-gray-800 disabled:cursor-not-allowed " +
    "transition-colors";

  const NAME_BLOCK = 44;
  const COLUMN_PADDING = 12;
  const playAreaHeight = boardSize + NAME_BLOCK * 2 + COLUMN_PADDING * 2;
  const reserveHeight = playAreaHeight;
  const controlsWidth = boardSize * 2 + RESERVE_COLUMN_WIDTH_PX * 2 + GAP_PX * 3;

  const canGoBack = state.cursorNodeId !== state.tree.rootId;
  const canGoForward = Boolean(state.tree.nodesById[state.cursorNodeId]?.children.length);

  const handleStart = useCallback(() => {
    selectNode(state.tree.rootId);
  }, [selectNode, state.tree.rootId]);

  const handlePrevious = useCallback(() => {
    navBack();
  }, [navBack]);

  const handleNext = useCallback(() => {
    navForwardOrOpenSelector();
  }, [navForwardOrOpenSelector]);

  const handleEnd = useCallback(() => {
    let nodeId = state.cursorNodeId;
    while (true) {
      const node = state.tree.nodesById[nodeId];
      if (!node?.mainChildId) break;
      nodeId = node.mainChildId;
    }
    selectNode(nodeId);
  }, [selectNode, state.cursorNodeId, state.tree.nodesById]);

  const formatClock = useCallback((deciseconds?: number) => {
    if (typeof deciseconds !== "number" || !Number.isFinite(deciseconds)) return "";
    const safeValue = Math.max(0, Math.floor(deciseconds));
    const minutes = Math.floor(safeValue / 600);
    const seconds = Math.floor((safeValue % 600) / 10);
    const tenths = safeValue % 10;
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
  }, []);

  const getBoardMoveCountsAtNode = useCallback(
    (nodeId: string): { A: number; B: number } => {
      let a = 0;
      let b = 0;
      let cursor = state.tree.nodesById[nodeId];
      while (cursor?.parentId) {
        const mv = cursor.incomingMove;
        if (mv?.board === "A") a += 1;
        if (mv?.board === "B") b += 1;
        cursor = state.tree.nodesById[cursor.parentId];
      }
      return { A: a, B: b };
    },
    [state.tree.nodesById],
  );

  const clockSnapshot = useMemo(() => {
    if (!processedGame) return null;

    const initialTime = processedGame.initialTime;

    const buildTimeline = (timestamps: number[], moveCount: number) => {
      const timeline: Array<{ white: number; black: number }> = [
        {
          white: Math.max(0, Math.floor(initialTime)),
          black: Math.max(0, Math.floor(initialTime)),
        },
      ];

      let currentWhite = timeline[0].white;
      let currentBlack = timeline[0].black;

      for (let i = 0; i < moveCount; i++) {
        const isWhiteMove = i % 2 === 0;
        const provided = timestamps[i];
        const next = { white: currentWhite, black: currentBlack };

        if (Number.isFinite(provided)) {
          const remaining = Math.max(0, Math.floor(provided));
          if (isWhiteMove) {
            next.white = remaining;
            currentWhite = remaining;
          } else {
            next.black = remaining;
            currentBlack = remaining;
          }
        }

        timeline.push(next);
      }

      while (timeline.length < moveCount + 1) {
        timeline.push({ white: currentWhite, black: currentBlack });
      }

      return timeline;
    };

    const counts = getBoardMoveCountsAtNode(state.cursorNodeId);

    const timelineA = buildTimeline(
      processedGame.originalGame.timestamps,
      processedGame.originalGame.moves.length,
    );
    const timelineB = buildTimeline(
      processedGame.partnerGame.timestamps,
      processedGame.partnerGame.moves.length,
    );

    const clamp = (timeline: Array<{ white: number; black: number }>, idx: number) =>
      timeline[Math.min(Math.max(idx, 0), timeline.length - 1)];

    return {
      A: clamp(timelineA, counts.A),
      B: clamp(timelineB, counts.B),
    };
  }, [getBoardMoveCountsAtNode, processedGame, state.cursorNodeId]);

  const renderPlayerBar = useCallback(
    (player: BughousePlayer, clockValue?: number) => (
      <div
        className="flex items-center justify-between w-full px-3 text-xl font-bold text-white tracking-wide"
        style={{ width: boardSize }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate min-w-0" title={player.username}>
            {player.username}
          </span>
          {typeof player.rating === "number" && Number.isFinite(player.rating) && (
            <span className="shrink-0 text-sm font-semibold text-white/60">
              ({Math.round(player.rating)})
            </span>
          )}
        </div>
        {shouldRenderClocks && typeof clockValue === "number" ? (
          <span className="font-mono text-lg tabular-nums text-white/90">
            {formatClock(clockValue)}
          </span>
        ) : (
          <span className="font-mono text-lg tabular-nums text-white/60" />
        )}
      </div>
    ),
    [boardSize, formatClock, shouldRenderClocks],
  );

  const getSideToMove = useCallback((fen: string): "white" | "black" => {
    const turn = new Chess(fen).turn();
    return turn === "w" ? "white" : "black";
  }, []);

  const handleDragStart = useCallback(
    (payload: { board: "A" | "B"; source: Square; piece: string }) => {
      if (state.pendingDrop) {
        // Avoid mixed interaction modes: cancel dragging while a drop is armed.
        return false;
      }
      const fen = payload.board === "A" ? currentPosition.fenA : currentPosition.fenB;
      const sideToMove = getSideToMove(fen);
      const pieceColor = payload.piece.startsWith("w") ? "white" : "black";
      return pieceColor === sideToMove;
    },
    [currentPosition.fenA, currentPosition.fenB, getSideToMove, state.pendingDrop],
  );

  const handleAttemptMove = useCallback(
    (payload: { board: "A" | "B"; from: Square; to: Square; piece: string }) => {
      const result = tryApplyMove({
        kind: "normal",
        board: payload.board,
        from: payload.from,
        to: payload.to,
      });

      if (result.type === "ok") {
        return;
      }

      if (result.type === "needs_promotion") {
        toast("Promotion required", { id: "promotion-required" });
        return "snapback";
      }

      if (result.type === "error" && result.message === "Game is already over.") {
        toast("Game is already over", { id: "game-over", duration: 1600 });
        return "snapback";
      }

      if (result.message === "Illegal move.") {
        toast("Illegal move", { id: "illegal-move", duration: 1400 });
      } else {
        toast.error(result.message);
      }
      return "snapback";
    },
    [tryApplyMove],
  );

  const handleSquareClick = useCallback(
    (payload: { board: "A" | "B"; square: Square }) => {
      const pending = state.pendingDrop;
      if (!pending) return;
      if (pending.board !== payload.board) {
        toast.error(`Selected drop is for board ${pending.board}.`);
        return;
      }

      const result = tryApplyMove({
        kind: "drop",
        board: payload.board,
        side: pending.side,
        piece: pending.piece,
        to: payload.square,
      });

      if (result.type === "ok") {
        return;
      }

      if (result.type === "error" && result.message === "Game is already over.") {
        toast("Game is already over", { id: "game-over", duration: 1600 });
        return;
      }

      if (result.type === "needs_promotion") {
        // Drops never promote; treat as a generic error state.
        toast.error(result.message);
        return;
      }

      toast.error(result.message);
    },
    [state.pendingDrop, tryApplyMove],
  );

  const handleReservePieceDragStart = useCallback(
    (
      board: "A" | "B",
      payload: { color: "white" | "black"; piece: "p" | "n" | "b" | "r" | "q" },
    ) => {
      const fen = board === "A" ? currentPosition.fenA : currentPosition.fenB;
      const sideToMove = getSideToMove(fen);
      if (payload.color !== sideToMove) {
        toast.error(`It is ${sideToMove} to move on board ${board}.`);
        return false;
      }

      // Arm the same pending-drop state used for click-to-drop so:
      // - the reserve highlight is consistent
      // - Escape cancels drag mode
      setPendingDrop({ board, side: payload.color, piece: payload.piece });
      return true;
    },
    [currentPosition.fenA, currentPosition.fenB, getSideToMove, setPendingDrop],
  );

  const handleReservePieceDragEnd = useCallback(() => {
    // Clear pending-drop state after drag ends (successful or cancelled).
    setPendingDrop(null);
  }, [setPendingDrop]);

  const handleAttemptReserveDrop = useCallback(
    (payload: {
      board: "A" | "B";
      to: Square;
      side: "white" | "black";
      piece: "p" | "n" | "b" | "r" | "q";
    }) => {
      const fen = payload.board === "A" ? currentPosition.fenA : currentPosition.fenB;
      const sideToMove = getSideToMove(fen);
      if (payload.side !== sideToMove) {
        toast.error(`It is ${sideToMove} to move on board ${payload.board}.`);
        return "snapback";
      }

      const result = tryApplyMove({
        kind: "drop",
        board: payload.board,
        side: payload.side,
        piece: payload.piece,
        to: payload.to,
      });

      if (result.type === "ok") {
        setPendingDrop(null);
        return;
      }

      if (result.type === "error" && result.message === "Game is already over.") {
        toast("Game is already over", { id: "game-over", duration: 1600 });
        return "snapback";
      }

      toast.error(result.message);
      return "snapback";
    },
    [currentPosition.fenA, currentPosition.fenB, getSideToMove, setPendingDrop, tryApplyMove],
  );

  const handleReservePieceClick = useCallback(
    (board: "A" | "B", payload: { color: "white" | "black"; piece: "p" | "n" | "b" | "r" | "q" }) => {
      const fen = board === "A" ? currentPosition.fenA : currentPosition.fenB;
      const sideToMove = getSideToMove(fen);
      if (payload.color !== sideToMove) {
        toast.error(`It is ${sideToMove} to move on board ${board}.`);
        return;
      }

      const next =
        state.pendingDrop &&
        state.pendingDrop.board === board &&
        state.pendingDrop.side === payload.color &&
        state.pendingDrop.piece === payload.piece
          ? null
          : { board, side: payload.color, piece: payload.piece };

      setPendingDrop(next);
    },
    [currentPosition.fenA, currentPosition.fenB, getSideToMove, setPendingDrop, state.pendingDrop],
  );

  return (
    <div className="w-full mx-auto">
      <div className="flex justify-center gap-6 items-start">
        {/* Left Column: Boards + Controls */}
        <div className="flex flex-col items-center gap-4 grow min-w-0 relative">
          {state.pendingPromotion && (
            <PromotionPicker
              allowed={state.pendingPromotion.allowed}
              onCancel={cancelPendingPromotion}
              onPick={(piece) => {
                const res = commitPromotion(piece);
                if (res.type === "error") toast.error(res.message);
              }}
            />
          )}
          {state.variationSelector?.open && (
            <VariationSelector
              tree={state.tree}
              selector={state.variationSelector}
              onSelectIndex={setVariationSelectorIndex}
              onAccept={acceptVariationSelector}
              onCancel={closeVariationSelector}
            />
          )}
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm rounded-lg">
              <div className="flex flex-col items-center gap-3 text-gray-100">
                <div className="h-10 w-10 rounded-full border-4 border-mariner-500/40 border-t-mariner-200 animate-spin" />
                <p className="text-sm text-gray-200">Loading game data…</p>
              </div>
            </div>
          )}

          {/* Boards Container with Reserves */}
          <div
            ref={boardsContainerRef}
            className="flex gap-4 justify-center items-stretch min-w-0"
            style={{ height: playAreaHeight }}
          >
            {/* Left Reserves (Board A) */}
            <div className="flex flex-col justify-start shrink-0 w-16 h-full">
              <PieceReserveVertical
                whiteReserves={currentPosition.reserves.A.white}
                blackReserves={currentPosition.reserves.A.black}
                bottomColor={isBoardsFlipped ? "black" : "white"}
                height={reserveHeight}
                onPieceClick={(payload) => handleReservePieceClick("A", payload)}
                onPieceDragStart={(payload) => handleReservePieceDragStart("A", payload)}
                onPieceDragEnd={handleReservePieceDragEnd}
                selected={
                  state.pendingDrop?.board === "A"
                    ? { color: state.pendingDrop.side, piece: state.pendingDrop.piece }
                    : null
                }
              />
            </div>

            {/* Board A */}
            <div className="flex flex-col items-center justify-between h-full py-2 gap-2">
              {isBoardsFlipped
                ? renderPlayerBar(players.aWhite, clockSnapshot?.A.white)
                : renderPlayerBar(players.aBlack, clockSnapshot?.A.black)}
              <ChessBoard
                fen={currentPosition.fenA}
                boardName="A"
                size={boardSize}
                flip={isBoardsFlipped}
                promotedSquares={currentPosition.promotedSquares.A}
                draggable
                onDragStart={handleDragStart}
                onAttemptMove={handleAttemptMove}
                onSquareClick={handleSquareClick}
                onAttemptReserveDrop={handleAttemptReserveDrop}
              />
              {isBoardsFlipped
                ? renderPlayerBar(players.aBlack, clockSnapshot?.A.black)
                : renderPlayerBar(players.aWhite, clockSnapshot?.A.white)}
            </div>

            {/* Board B */}
            <div className="flex flex-col items-center justify-between h-full py-2 gap-2">
              {isBoardsFlipped
                ? renderPlayerBar(players.bBlack, clockSnapshot?.B.black)
                : renderPlayerBar(players.bWhite, clockSnapshot?.B.white)}
              <ChessBoard
                fen={currentPosition.fenB}
                boardName="B"
                size={boardSize}
                flip={!isBoardsFlipped}
                promotedSquares={currentPosition.promotedSquares.B}
                draggable
                onDragStart={handleDragStart}
                onAttemptMove={handleAttemptMove}
                onSquareClick={handleSquareClick}
                onAttemptReserveDrop={handleAttemptReserveDrop}
              />
              {isBoardsFlipped
                ? renderPlayerBar(players.bWhite, clockSnapshot?.B.white)
                : renderPlayerBar(players.bBlack, clockSnapshot?.B.black)}
            </div>

            {/* Right Reserves (Board B) */}
            <div className="flex flex-col justify-start shrink-0 w-16 h-full">
              <PieceReserveVertical
                whiteReserves={currentPosition.reserves.B.white}
                blackReserves={currentPosition.reserves.B.black}
                bottomColor={isBoardsFlipped ? "white" : "black"}
                height={reserveHeight}
                onPieceClick={(payload) => handleReservePieceClick("B", payload)}
                onPieceDragStart={(payload) => handleReservePieceDragStart("B", payload)}
                onPieceDragEnd={handleReservePieceDragEnd}
                selected={
                  state.pendingDrop?.board === "B"
                    ? { color: state.pendingDrop.side, piece: state.pendingDrop.piece }
                    : null
                }
              />
            </div>
          </div>

          {/* Board Controls */}
          <div
            className="relative flex items-center justify-center"
            style={{ width: controlsWidth }}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={handleStart}
                disabled={!canGoBack}
                className={controlButtonBaseClass}
                title="Start"
                aria-label="Jump to start"
                type="button"
              >
                <SkipBack aria-hidden className="h-5 w-5" />
              </button>
              <button
                onClick={handlePrevious}
                disabled={!canGoBack}
                className={controlButtonBaseClass}
                title="Previous"
                aria-label="Previous move"
                type="button"
              >
                <StepBack aria-hidden className="h-5 w-5" />
              </button>
              <button
                onClick={handleNext}
                disabled={!canGoForward}
                className={controlButtonBaseClass}
                title="Next"
                aria-label="Next move"
                type="button"
              >
                <StepForward aria-hidden className="h-5 w-5" />
              </button>
              <button
                onClick={handleEnd}
                disabled={!canGoForward}
                className={controlButtonBaseClass}
                title="End"
                aria-label="Jump to end"
                type="button"
              >
                <SkipForward aria-hidden className="h-5 w-5" />
              </button>
            </div>

            <button
              onClick={toggleBoardsFlipped}
              className={`${controlButtonBaseClass} absolute right-1 bottom-0`}
              title="Flip boards (F)"
              aria-label="Flip boards"
              type="button"
            >
              <FlipVertical aria-hidden className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Right Column: Move list placeholder (MoveTree lands next) */}
        <div
          className="shrink-0 w-[320px] md:w-[340px] lg:w-[360px]"
          style={{ height: playAreaHeight }}
        >
          <MoveListWithVariations
            tree={state.tree}
            cursorNodeId={state.cursorNodeId}
            selectedNodeId={state.selectedNodeId}
            players={players}
            onSelectNode={selectNode}
            onPromoteVariationOneLevel={promoteVariationOneLevel}
            onTruncateAfterNode={truncateAfterNode}
          />
        </div>
      </div>
    </div>
  );
};

export default BughouseAnalysis;

