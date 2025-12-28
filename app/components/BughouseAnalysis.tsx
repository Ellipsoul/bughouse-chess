"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import {
  ChevronLeft,
  Pause,
  Play,
  RefreshCcw,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
} from "lucide-react";
import toast from "react-hot-toast";
import type { ChessGame } from "../actions";
import { processGameData } from "../utils/moveOrdering";
import { deriveBughouseConclusionSummary } from "../utils/gameConclusion";
import type { BughouseMove } from "../types/bughouse";
import type { BughousePlayer } from "../types/bughouse";
import type { AnalysisNode } from "../types/analysis";
import { buildBughouseClockTimeline } from "../utils/analysis/buildBughouseClockTimeline";
import { buildPerBoardMoveDurationsDeciseconds } from "../utils/analysis/buildPerBoardMoveDurationsDeciseconds";
import { getClockTintClasses, getTeamTimeDiffDeciseconds } from "../utils/clockAdvantage";
import {
  createInitialPositionSnapshot,
  validateAndApplyMoveFromNotation,
} from "../utils/analysis/applyMove";
import ChessBoard from "./ChessBoard";
import PieceReserveVertical from "./PieceReserveVertical";
import { reorderSimultaneousCheckmateMove, useAnalysisState } from "./useAnalysisState";
import VariationSelector from "./VariationSelector";
import PromotionPicker from "./PromotionPicker";
import MoveListWithVariations from "./MoveListWithVariations";
import { ChessTitleBadge } from "./ChessTitleBadge";
import { TooltipAnchor } from "./TooltipAnchor";
import { BoardCornerMaterial } from "./BoardCornerMaterial";
import type { BoardAnnotations } from "../utils/boardAnnotations";
import {
  createEmptyBoardAnnotationsByFen,
  getAnnotationsForFen,
  setAnnotationsForFen,
  toFenKey,
} from "../utils/boardAnnotationPersistence";
import {
  buildBughouseBoardMoveCountsByGlobalPly,
  buildMonotonicMoveTimestampsDeciseconds,
  getBughouseClockSnapshotAtElapsedDeciseconds,
  getLiveReplayElapsedDecisecondsAtGlobalPly,
  isPristineLoadedMainline,
} from "../utils/analysis/liveReplay";
import { useCompactLandscape } from "../utils/useCompactLandscape";

interface BughouseAnalysisProps {
  gameData?: {
    original: ChessGame;
    partner: ChessGame | null;
  } | null;
  isLoading?: boolean;
  /**
   * Pre-formatted “games analysed” label (e.g. `Games Analysed: 1,234`).
   * Owned by the page shell so we don't duplicate metric fetches.
   */
  gamesLoadedLabel?: string;
  /**
   * When true, renders the games-analysed counter inline in the move list footer
   * (instead of as a floating overlay badge).
   */
  showGamesLoadedInline?: boolean;
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
  gamesLoadedLabel,
  showGamesLoadedInline,
  onAnalysisDirtyChange,
}) => {
  const analysisContainerRef = useRef<HTMLDivElement>(null);
  const boardsContainerRef = useRef<HTMLDivElement>(null);
  const controlsContainerRef = useRef<HTMLDivElement>(null);
  const isCompactLandscape = useCompactLandscape();
  const {
    state,
    currentPosition,
    selectNode,
    navBack,
    navForwardOrOpenSelector,
    loadGameMainline,
    promoteVariationOneLevel,
    truncateAfterNode,
    truncateFromNodeInclusive,
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

  /**
   * Persist user board drawings (circles/arrows) per *board position* (FEN) per board.
   *
   * Why FEN-keyed (instead of node-id keyed):
   * - It restores drawings when returning to the exact same position.
   * - It also preserves drawings on the *other* bughouse board when navigating moves on one board
   *   (because the other board's FEN remains unchanged across those nodes).
   */
  const [annotationsByFen, setAnnotationsByFen] = useState(() => createEmptyBoardAnnotationsByFen());

  const boardAFenKey = toFenKey(currentPosition.fenA);
  const boardBFenKey = toFenKey(currentPosition.fenB);
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

  const toggleBoardsFlipped = useCallback(() => {
    setIsBoardsFlipped((prev) => !prev);
  }, []);

  /**
   * Responsive board sizing.
   *
   * The app is designed primarily for iPad/tablet and larger. For phone landscape, we
   * intentionally trade density for usability (smaller player bars, tighter gaps, smaller
   * control buttons) and allow the move list to be reached by scrolling the page shell.
   */
  const layout = useMemo(() => {
    if (isCompactLandscape) {
      return {
        defaultBoardSize: 360,
        minBoardSize: 210,
        reserveColumnWidthPx: 64, // Tailwind `w-16`
        gapPx: 8, // Tailwind `gap-2`
        nameBlockPx: 34,
        columnPaddingPx: 6,
        minMoveListHeightPx: 0, // move list can be reached by scrolling in compact mode
        controlsGapPx: 8, // gap between boards and controls
        sectionsGapPx: 16, // gap between left column and move list (stacked)
        controlButtonSizeClass: "h-8 w-8",
        controlIconSizeClass: "h-4 w-4",
      };
    }

    return {
      defaultBoardSize: 400,
      minBoardSize: 260,
      reserveColumnWidthPx: 64, // Tailwind `w-16`
      gapPx: 16, // Tailwind `gap-4`
      nameBlockPx: 44,
      columnPaddingPx: 12,
      minMoveListHeightPx: 220,
      controlsGapPx: 16,
      sectionsGapPx: 24,
      controlButtonSizeClass: "h-10 w-10",
      controlIconSizeClass: "h-5 w-5",
    };
  }, [isCompactLandscape]);

  const BH_DESKTOP_MIN_WIDTH_PX = 1400;
  const [boardSize, setBoardSize] = useState(layout.defaultBoardSize);
  useEffect(() => {
    const boardsContainer = boardsContainerRef.current;
    if (!boardsContainer) return;

    const computeBoardSize = () => {
      // Width-driven cap (always): reserve | boardA | boardB | reserve => 3 gaps
      const availableWidth =
        boardsContainer.clientWidth - (layout.reserveColumnWidthPx * 2 + layout.gapPx * 3);
      const widthCandidate = Math.floor(availableWidth / 2);

      // Height-driven cap (stacked/tablet only): ensure we leave a reasonable amount of room
      // for the move list so the page doesn't need to scroll.
      let heightCap = layout.defaultBoardSize;
      const isDesktop =
        typeof window !== "undefined" &&
        window.matchMedia(`(min-width: ${BH_DESKTOP_MIN_WIDTH_PX}px)`).matches;

      if (!isDesktop) {
        const containerHeight = (() => {
          if (typeof window === "undefined") return 0;
          const el = analysisContainerRef.current;
          if (!el) return 0;

          // In compact landscape we allow the analysis content to grow taller than the viewport
          // (so the move list can be reached by scrolling). For board sizing, we still want to
          // cap to the *visible viewport height* so boards+controls stay in view.
          if (isCompactLandscape) {
            const top = el.getBoundingClientRect().top;
            return Math.max(0, Math.floor(window.innerHeight - top));
          }

          return el.clientHeight;
        })();
        const controlsHeight = controlsContainerRef.current?.clientHeight ?? 40;

        const GAP_BOARDS_CONTROLS_PX = layout.controlsGapPx;
        const GAP_SECTIONS_PX = layout.sectionsGapPx;
        const MIN_MOVELIST_HEIGHT_PX = layout.minMoveListHeightPx;

        if (containerHeight > 0) {
          const availablePlayAreaHeight =
            containerHeight -
            controlsHeight -
            GAP_BOARDS_CONTROLS_PX -
            // Only reserve move list space in non-compact modes.
            (MIN_MOVELIST_HEIGHT_PX > 0 ? GAP_SECTIONS_PX + MIN_MOVELIST_HEIGHT_PX : 0);

          const maxBoardSizeFromHeight =
            availablePlayAreaHeight - layout.nameBlockPx * 2 - layout.columnPaddingPx * 2;

          if (Number.isFinite(maxBoardSizeFromHeight)) {
            heightCap = Math.floor(maxBoardSizeFromHeight);
          }
        }
      }

      const capped = Math.min(widthCandidate, heightCap);
      const nextSize = Math.max(layout.minBoardSize, Math.min(layout.defaultBoardSize, capped));
      setBoardSize((prev) => (prev === nextSize ? prev : nextSize));
    };

    computeBoardSize();
    const resizeObserver = new ResizeObserver(() => computeBoardSize());
    resizeObserver.observe(boardsContainer);
    if (analysisContainerRef.current) {
      resizeObserver.observe(analysisContainerRef.current);
    }
    if (controlsContainerRef.current) {
      resizeObserver.observe(controlsContainerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, [BH_DESKTOP_MIN_WIDTH_PX, isCompactLandscape, layout]);

  const processedGame = useMemo(() => {
    if (!gameData) return null;
    return processGameData(gameData.original, gameData.partner);
  }, [gameData]);

  const players = processedGame?.players ?? PLACEHOLDER_PLAYERS;
  const shouldRenderClocks = Boolean(processedGame);

  type LiveReplayStatus = "idle" | "playing" | "finished";
  const [liveReplayStatus, setLiveReplayStatus] = useState<LiveReplayStatus>("idle");
  const isLiveReplayPlaying = liveReplayStatus === "playing";

  /**
   * Live replay “playhead” time in deciseconds, expressed as elapsed time since game start.
   *
   * - When not playing, this value is ignored (clocks use the cursor/anchor node instead).
   * - While playing, we update this at most once per decisecond (10Hz) to keep renders bounded.
   */
  const [liveReplayElapsedDeciseconds, setLiveReplayElapsedDeciseconds] = useState(0);
  const liveReplayRafIdRef = useRef<number | null>(null);
  const liveReplayStartPerfMsRef = useRef<number | null>(null);
  const liveReplayBaseElapsedDecisecondsRef = useRef(0);
  const liveReplayLastEmittedDecisecondsRef = useRef<number>(-1);
  const liveReplaySpaceToggleRef = useRef<(() => boolean) | null>(null);
  const liveReplaySeekDeltaRef = useRef<((delta: -1 | 1) => boolean) | null>(null);

  const stopLiveReplayLoop = useCallback(() => {
    if (typeof window === "undefined") return;
    const rafId = liveReplayRafIdRef.current;
    if (typeof rafId === "number") {
      window.cancelAnimationFrame(rafId);
    }
    liveReplayRafIdRef.current = null;
    liveReplayStartPerfMsRef.current = null;
    liveReplayLastEmittedDecisecondsRef.current = -1;
  }, []);

  /**
   * When dragging a piece on the board (not reserve drops), highlight legal destination squares.
   *
   * This is purely a UI affordance: it does not validate or apply moves.
   *
   * Note: Declared early because live replay clears this state before playback starts.
   */
  const [dragLegalMoveHighlight, setDragLegalMoveHighlight] = useState<{
    board: "A" | "B";
    /**
     * The FEN used to compute legal targets at drag start. If the position changes while
     * dragging (e.g., navigation), we intentionally suppress the highlight rather than
     * trying to keep it in sync.
     */
    fenAtDragStart: string;
    from: Square;
    targets: Square[];
  } | null>(null);

  const mainlineMoveCount = useMemo(() => {
    let count = 0;
    let nodeId: string | null = state.tree.rootId;
    while (nodeId) {
      const analysisNode: AnalysisNode | undefined = state.tree.nodesById[nodeId];
      const nextMainlineNodeId: string | null = analysisNode?.mainChildId ?? null;
      if (!nextMainlineNodeId) break;
      count += 1;
      nodeId = nextMainlineNodeId;
    }
    return count;
  }, [state.tree.nodesById, state.tree.rootId]);

  const gameConclusionFooter = useMemo(() => {
    if (!gameData || !processedGame) return null;
    const expectedMainlineMoveCount = processedGame.combinedMoves.length;

    // Only show the game conclusion when:
    // - a game is loaded
    // - chess.com reports a conclusion
    // - the current analysis mainline still matches the originally loaded mainline
    //   (hide when the user truncates or extends beyond the final mainline move)
    const summary = deriveBughouseConclusionSummary(gameData.original, gameData.partner);
    if (!summary) return null;
    if (expectedMainlineMoveCount <= 0) return null;
    if (mainlineMoveCount !== expectedMainlineMoveCount) return null;

    const shouldShowGamesLoadedInline = Boolean(showGamesLoadedInline && gamesLoadedLabel);

    return (
      <div className="px-3 py-2">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[10px] uppercase tracking-wider text-gray-400">
            Game result
          </div>
          <div className="text-[10px] text-gray-500">
            Source: Board {summary.sourceBoard}
          </div>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <div className="text-sm text-gray-100">
            <span className="font-semibold">{summary.result}</span>
            <span className="text-gray-400"> — </span>
            <span className="text-gray-200">{summary.reason}</span>
          </div>
          {shouldShowGamesLoadedInline ? (
            <div className="text-[9px] text-gray-500 leading-tight shrink-0">
              <span className="font-mono tabular-nums">{gamesLoadedLabel}</span>
            </div>
          ) : null}
        </div>
      </div>
    );
  }, [gameData, gamesLoadedLabel, mainlineMoveCount, processedGame, showGamesLoadedInline]);

  const moveListFooter = useMemo(() => {
    if (gameConclusionFooter) return gameConclusionFooter;
    if (!showGamesLoadedInline || !gamesLoadedLabel) return null;

    return (
      <div className="px-3 py-2">
        <div className="flex items-center justify-end text-right text-[9px] text-gray-500 leading-tight">
          <span className="font-mono tabular-nums">{gamesLoadedLabel}</span>
        </div>
      </div>
    );
  }, [gameConclusionFooter, gamesLoadedLabel, showGamesLoadedInline]);

  /**
   * The chess.com `moveList` parsing yields “SAN-ish” strings (often including source squares,
   * e.g. `Ng1f3`) which we then normalize to proper SAN (`Nf3`) when building the analysis tree.
   *
   * Move-time display in `MoveListWithVariations` matches mainline nodes back to the loaded
   * `combinedMoves` array. To keep that matching reliable, we pre-normalize `combinedMoves[].move`
   * to the same SAN strings stored on analysis nodes (`incomingMove.san`).
   *
   * This is purely a UI convenience: we keep timestamps/ordering unchanged.
   */
  const combinedMovesForMoveTimes = useMemo((): BughouseMove[] | undefined => {
    if (!processedGame?.combinedMoves?.length) return undefined;

    // Pre-process moves to handle simultaneous checkmate situations
    const reorderedMoves = reorderSimultaneousCheckmateMove(processedGame.combinedMoves);

    const sanitized: BughouseMove[] = [];
    let position = createInitialPositionSnapshot();

    for (const combinedMove of reorderedMoves) {
      const applied = validateAndApplyMoveFromNotation(position, {
        board: combinedMove.board,
        side: combinedMove.side,
        move: combinedMove.move,
      });

      if (applied.type === "ok") {
        sanitized.push({ ...combinedMove, move: applied.move.san });
        position = applied.next;
        continue;
      }

      // If we can't normalize a move here, fall back to the raw string so the UI stays resilient.
      sanitized.push(combinedMove);
    }

    return sanitized;
  }, [processedGame]);

  const clockTimelineResult = useMemo(() => {
    if (!processedGame) return null;
    return buildBughouseClockTimeline(processedGame);
  }, [processedGame]);

  const combinedMoveDurationsForMoveTimes = useMemo((): number[] | undefined => {
    if (!combinedMovesForMoveTimes?.length) return undefined;
    // Important: The move-list subscript is intentionally **per-board**:
    // it measures elapsed time since the previous move on the *same* board.
    //
    // This differs from the global “either-board” delta used by clock simulation/live replay.
    return buildPerBoardMoveDurationsDeciseconds(combinedMovesForMoveTimes);
  }, [combinedMovesForMoveTimes]);

  const monotonicMoveTimestampsDeciseconds = useMemo(() => {
    if (!processedGame) return null;
    return buildMonotonicMoveTimestampsDeciseconds(processedGame.combinedMoves);
  }, [processedGame]);

  const boardMoveCountsByGlobalPly = useMemo(() => {
    if (!processedGame) return null;
    return buildBughouseBoardMoveCountsByGlobalPly(processedGame.combinedMoves);
  }, [processedGame]);

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
          target.tagName === "SELECT" ||
          target.tagName === "BUTTON" ||
          target.tagName === "A");
      if (isTypingTarget) return;

      // Live replay play/pause toggle: Space.
      // - Works only when the replay feature is eligible (same as the buttons).
      // - While playing, Space pauses.
      if (event.code === "Space" || event.key === " ") {
        const didToggle = liveReplaySpaceToggleRef.current?.() ?? false;
        if (didToggle) {
          event.preventDefault();
          return;
        }
      }

      // Flipping boards is a purely visual preference and is safe during live replay.
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleBoardsFlipped();
        return;
      }

      // Live replay intentionally disables all keyboard navigation so playback cannot be
      // interrupted by accidental key presses.
      if (isLiveReplayPlaying) {
        // Allow skipping between moves (seek) even while playback is running.
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          liveReplaySeekDeltaRef.current?.(-1);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          liveReplaySeekDeltaRef.current?.(1);
        }
        return;
      }

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
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [
    acceptVariationSelector,
    closeVariationSelector,
    cancelPendingPromotion,
    commitPromotion,
    isLiveReplayPlaying,
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
    `${layout.controlButtonSizeClass} flex items-center justify-center rounded-md bg-gray-800 text-gray-200 border border-gray-700 cursor-pointer ` +
    "hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-600 disabled:border-gray-800 disabled:cursor-not-allowed " +
    "transition-colors";

  const playAreaHeight = boardSize + layout.nameBlockPx * 2 + layout.columnPaddingPx * 2;
  const reserveHeight = playAreaHeight;
  const controlsWidth =
    boardSize * 2 + layout.reserveColumnWidthPx * 2 + layout.gapPx * 3;

  const canGoBack = state.cursorNodeId !== state.tree.rootId;
  const canGoForward = Boolean(state.tree.nodesById[state.cursorNodeId]?.children.length);

  const lastMoveHighlightsByBoard = useMemo(() => {
    const findLastMoveForBoard = (
      board: "A" | "B",
    ): { from: Square | null; to: Square } | null => {
      let nodeId: string | null = state.cursorNodeId;
      while (nodeId) {
        const analysisNode: AnalysisNode | undefined = state.tree.nodesById[nodeId];
        const move = analysisNode?.incomingMove;
        if (move && move.board === board) {
          if (move.kind === "normal" && move.normal) {
            return { from: move.normal.from, to: move.normal.to };
          }
          if (move.kind === "drop" && move.drop) {
            return { from: null as Square | null, to: move.drop.to };
          }
          return null;
        }
        nodeId = analysisNode?.parentId ?? null;
      }
      return null;
    };

    return {
      A: findLastMoveForBoard("A"),
      B: findLastMoveForBoard("B"),
    };
  }, [state.cursorNodeId, state.tree.nodesById]);

  const formatClock = useCallback((deciseconds?: number) => {
    if (typeof deciseconds !== "number" || !Number.isFinite(deciseconds)) return "";
    const safeValue = Math.max(0, Math.floor(deciseconds));
    const minutes = Math.floor(safeValue / 600);
    const seconds = Math.floor((safeValue % 600) / 10);
    const tenths = safeValue % 10;
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
  }, []);

  const getGlobalPlyCountAtNode = useCallback(
    (nodeId: string): number => {
      let count = 0;
      let cursor = state.tree.nodesById[nodeId];
      while (cursor?.parentId) {
        // Root has no incoming move; every other node corresponds to exactly one ply.
        if (cursor.incomingMove) count += 1;
        cursor = state.tree.nodesById[cursor.parentId];
      }
      return count;
    },
    [state.tree.nodesById],
  );

  /**
   * Mainline membership set (root + root→mainChildId chain).
   *
   * We treat the "mainline" as the canonical loaded game line; all other children
   * are variations (even if the user is exploring them via the cursor).
   */
  const mainlineNodeIdSet = useMemo(() => {
    const set = new Set<string>();
    let nodeId: string | null = state.tree.rootId;
    while (nodeId) {
      set.add(nodeId);
      const nextMainlineId: string | null = state.tree.nodesById[nodeId]?.mainChildId ?? null;
      nodeId = nextMainlineId;
    }
    return set;
  }, [state.tree.nodesById, state.tree.rootId]);

  const isCursorOnMainline = useMemo(() => {
    return mainlineNodeIdSet.has(state.cursorNodeId);
  }, [mainlineNodeIdSet, state.cursorNodeId]);

  const areClocksFrozen = shouldRenderClocks && !isCursorOnMainline;

  const effectiveClockNodeId = isCursorOnMainline
    ? state.cursorNodeId
    : state.clockAnchorNodeId;

  const clockSnapshot = useMemo(() => {
    if (!processedGame) return null;
    if (!clockTimelineResult) return null;

    if (
      isLiveReplayPlaying &&
      monotonicMoveTimestampsDeciseconds &&
      boardMoveCountsByGlobalPly
    ) {
      return getBughouseClockSnapshotAtElapsedDeciseconds({
        timeline: clockTimelineResult.timeline,
        monotonicMoveTimestamps: monotonicMoveTimestampsDeciseconds,
        boardMoveCountsByGlobalPly,
        elapsedDeciseconds: liveReplayElapsedDeciseconds,
      });
    }

    const plyCount = getGlobalPlyCountAtNode(effectiveClockNodeId);
    const clampedIndex = Math.min(
      Math.max(plyCount, 0),
      clockTimelineResult.timeline.length - 1,
    );
    return clockTimelineResult.timeline[clampedIndex] ?? null;
  }, [
    boardMoveCountsByGlobalPly,
    clockTimelineResult,
    effectiveClockNodeId,
    getGlobalPlyCountAtNode,
    isLiveReplayPlaying,
    liveReplayElapsedDeciseconds,
    monotonicMoveTimestampsDeciseconds,
    processedGame,
  ]);

  /**
   * Precompute the mainline node IDs by ply so live replay can jump in O(1) when time advances.
   *
   * - index 0 => root position (before any moves)
   * - index p => node ID after applying `p` global moves
   */
  const mainlineNodeIdsByGlobalPly = useMemo(() => {
    const ids: string[] = [state.tree.rootId];
    let nodeId: string | null = state.tree.rootId;
    while (nodeId) {
      const nextMainlineId: string | null =
        state.tree.nodesById[nodeId]?.mainChildId ?? null;
      if (!nextMainlineId) break;
      ids.push(nextMainlineId);
      nodeId = nextMainlineId;
    }
    return ids;
  }, [state.tree.nodesById, state.tree.rootId]);

  /**
   * Seek the live replay playhead (and cursor) to a specific global ply while keeping playback running.
   *
   * This is intentionally mainline-only: we map ply -> node via `mainlineNodeIdsByGlobalPly` so the
   * cursor stays on the pristine loaded line during replay.
   */
  const seekLiveReplayToGlobalPly = useCallback(
    (requestedGlobalPly: number): boolean => {
      if (!combinedMovesForMoveTimes) return false;
      if (!monotonicMoveTimestampsDeciseconds) return false;

      const maxPly = combinedMovesForMoveTimes.length;
      const globalPly = Math.min(Math.max(0, Math.floor(requestedGlobalPly)), maxPly);
      const targetNodeId = mainlineNodeIdsByGlobalPly[globalPly];
      if (!targetNodeId) return false;

      const baseElapsed = getLiveReplayElapsedDecisecondsAtGlobalPly({
        globalPly,
        monotonicMoveTimestamps: monotonicMoveTimestampsDeciseconds,
      });
      const lastTimestamp =
        monotonicMoveTimestampsDeciseconds[monotonicMoveTimestampsDeciseconds.length - 1] ?? 0;

      // Update cursor first so the UI immediately reflects the new board position.
      selectNode(targetNodeId);

      // If we seek to the end-of-game timestamp, treat as finished (mirrors tick end logic).
      if (baseElapsed >= lastTimestamp && monotonicMoveTimestampsDeciseconds.length > 0) {
        stopLiveReplayLoop();
        setLiveReplayStatus("finished");
        setLiveReplayElapsedDeciseconds(lastTimestamp);
        return true;
      }

      // Re-base the playhead so the RAF loop continues forward from the new location.
      liveReplayBaseElapsedDecisecondsRef.current = baseElapsed;
      liveReplayStartPerfMsRef.current =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      liveReplayLastEmittedDecisecondsRef.current = baseElapsed;
      setLiveReplayElapsedDeciseconds(baseElapsed);
      return true;
    },
    [
      combinedMovesForMoveTimes,
      mainlineNodeIdsByGlobalPly,
      monotonicMoveTimestampsDeciseconds,
      selectNode,
      stopLiveReplayLoop,
    ],
  );

  const seekLiveReplayByDelta = useCallback(
    (delta: -1 | 1): boolean => {
      const currentPly = getGlobalPlyCountAtNode(state.cursorNodeId);
      return seekLiveReplayToGlobalPly(currentPly + delta);
    },
    [getGlobalPlyCountAtNode, seekLiveReplayToGlobalPly, state.cursorNodeId],
  );

  // Keep a stable, always-up-to-date seek handler so the keyboard effect can call it
  // without being reordered around live replay callbacks.
  useEffect(() => {
    liveReplaySeekDeltaRef.current = seekLiveReplayByDelta;
  }, [seekLiveReplayByDelta]);

  const handleStart = useCallback(() => {
    selectNode(state.tree.rootId);
  }, [selectNode, state.tree.rootId]);

  const handlePrevious = useCallback(() => {
    if (isLiveReplayPlaying) {
      seekLiveReplayByDelta(-1);
      return;
    }
    navBack();
  }, [isLiveReplayPlaying, navBack, seekLiveReplayByDelta]);

  const handleNext = useCallback(() => {
    if (isLiveReplayPlaying) {
      seekLiveReplayByDelta(1);
      return;
    }
    navForwardOrOpenSelector();
  }, [isLiveReplayPlaying, navForwardOrOpenSelector, seekLiveReplayByDelta]);

  const handleEnd = useCallback(() => {
    let nodeId = state.cursorNodeId;
    while (true) {
      const node = state.tree.nodesById[nodeId];
      if (!node?.mainChildId) break;
      nodeId = node.mainChildId;
    }
    selectNode(nodeId);
  }, [selectNode, state.cursorNodeId, state.tree.nodesById]);

  const liveReplayEligible = useMemo(() => {
    if (!processedGame) return false;
    if (!combinedMovesForMoveTimes) return false;
    return isPristineLoadedMainline({ tree: state.tree, combinedMoves: combinedMovesForMoveTimes });
  }, [combinedMovesForMoveTimes, processedGame, state.tree]);

  const isCursorAtEndOfLoadedMainline = useMemo(() => {
    if (!combinedMovesForMoveTimes) return false;
    const expectedPlyCount = combinedMovesForMoveTimes.length;
    const endNodeId = mainlineNodeIdsByGlobalPly[expectedPlyCount];
    if (!endNodeId) return false;
    return state.cursorNodeId === endNodeId;
  }, [combinedMovesForMoveTimes, mainlineNodeIdsByGlobalPly, state.cursorNodeId]);

  /**
   * When a live replay reaches the end, we enter `liveReplayStatus='finished'` so:
   * - playback stops automatically
   * - Play is disabled while the cursor remains at the end position
   *
   * If the user then navigates to an earlier move on the pristine mainline, we should allow
   * replay again. We do this as a **derived lock** rather than mutating state in an effect.
   */
  const isLiveReplayFinishedLocked = liveReplayStatus === "finished" && isCursorAtEndOfLoadedMainline;

  const liveReplayPlayDisabledReason = useMemo(() => {
    if (!processedGame) return "Load a game to enable live replay";
    if (!combinedMovesForMoveTimes?.length) return "No moves available to replay";
    if (!liveReplayEligible) return "Mainline has been edited; live replay is only available on the original loaded line";
    if (!isCursorOnMainline) return "Cursor must be on the mainline to start live replay";
    if (state.pendingPromotion) return "Resolve the pending promotion first";
    if (isLiveReplayFinishedLocked) {
      return "Reached end of game; navigate earlier on the mainline to replay again";
    }
    return null;
  }, [
    combinedMovesForMoveTimes,
    isCursorOnMainline,
    isLiveReplayFinishedLocked,
    liveReplayEligible,
    processedGame,
    state.pendingPromotion,
  ]);

  const canStartLiveReplay = !isLiveReplayPlaying && liveReplayPlayDisabledReason === null;

  const liveReplayPlayButtonTooltip = isLiveReplayPlaying
    ? "Pause live replay"
    : liveReplayPlayDisabledReason ?? "Play live replay";

  const handleLiveReplayPause = useCallback(() => {
    stopLiveReplayLoop();
    setLiveReplayStatus("idle");
  }, [stopLiveReplayLoop]);

  const handleLiveReplayPlay = useCallback(() => {
    if (!processedGame) return;
    if (!combinedMovesForMoveTimes) return;
    if (!monotonicMoveTimestampsDeciseconds) return;
    if (!boardMoveCountsByGlobalPly) return;
    if (!liveReplayEligible) return;
    if (!isCursorOnMainline) return;
    if (state.pendingPromotion) return;

    // If a previous loop is still running (shouldn't happen with disabled UI, but be safe),
    // stop it before starting a new one.
    stopLiveReplayLoop();

    // Reset transient interaction modes so playback starts from a clean UI state.
    setPendingDrop(null);
    setDragLegalMoveHighlight(null);
    closeVariationSelector();

    const plyAtCursor = getGlobalPlyCountAtNode(state.cursorNodeId);
    const lastMoveIndex = plyAtCursor - 1;
    const baseElapsed =
      lastMoveIndex >= 0 ? monotonicMoveTimestampsDeciseconds[lastMoveIndex] ?? 0 : 0;

    const lastTimestamp =
      monotonicMoveTimestampsDeciseconds[monotonicMoveTimestampsDeciseconds.length - 1] ?? 0;

    // If the cursor is already at the end-of-game timestamp, treat as finished.
    if (baseElapsed >= lastTimestamp && monotonicMoveTimestampsDeciseconds.length > 0) {
      setLiveReplayStatus("finished");
      setLiveReplayElapsedDeciseconds(lastTimestamp);
      return;
    }

    setLiveReplayStatus("playing");
    setLiveReplayElapsedDeciseconds(baseElapsed);

    liveReplayBaseElapsedDecisecondsRef.current = baseElapsed;
    liveReplayStartPerfMsRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
    liveReplayLastEmittedDecisecondsRef.current = baseElapsed;

    const findLastMoveIndexAtOrBeforeElapsed = (elapsedDs: number): number => {
      const ts = monotonicMoveTimestampsDeciseconds;
      let lo = 0;
      let hi = ts.length - 1;
      let ans = -1;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const t = ts[mid] ?? 0;
        if (t <= elapsedDs) {
          ans = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      return ans;
    };

    const tick = (nowMs: number) => {
      const startMs = liveReplayStartPerfMsRef.current;
      if (startMs === null) return;

      const elapsedSinceStartDs = Math.floor(Math.max(0, nowMs - startMs) / 100);
      const rawPlayhead = liveReplayBaseElapsedDecisecondsRef.current + elapsedSinceStartDs;
      const playhead = Math.min(lastTimestamp, rawPlayhead);

      if (playhead !== liveReplayLastEmittedDecisecondsRef.current) {
        liveReplayLastEmittedDecisecondsRef.current = playhead;
        setLiveReplayElapsedDeciseconds(playhead);

        const lastIdx = findLastMoveIndexAtOrBeforeElapsed(playhead);
        const targetPly = lastIdx + 1;
        const targetNodeId = mainlineNodeIdsByGlobalPly[targetPly];
        if (targetNodeId && targetNodeId !== state.cursorNodeId) {
          selectNode(targetNodeId);
        }

        // If we've reached the final move timestamp, stop playback and enter finished state.
        if (playhead >= lastTimestamp && lastIdx === monotonicMoveTimestampsDeciseconds.length - 1) {
          stopLiveReplayLoop();
          setLiveReplayStatus("finished");
          return;
        }
      }

      liveReplayRafIdRef.current = window.requestAnimationFrame(tick);
    };

    liveReplayRafIdRef.current = window.requestAnimationFrame(tick);
  }, [
    boardMoveCountsByGlobalPly,
    closeVariationSelector,
    combinedMovesForMoveTimes,
    getGlobalPlyCountAtNode,
    isCursorOnMainline,
    liveReplayEligible,
    mainlineNodeIdsByGlobalPly,
    monotonicMoveTimestampsDeciseconds,
    processedGame,
    selectNode,
    setPendingDrop,
    state.cursorNodeId,
    state.pendingPromotion,
    stopLiveReplayLoop,
  ]);

  // Keep a stable, always-up-to-date Space handler without needing to reorder the keyboard effect.
  useEffect(() => {
    liveReplaySpaceToggleRef.current = () => {
      if (isLiveReplayPlaying) {
        handleLiveReplayPause();
        return true;
      }
      if (canStartLiveReplay) {
        handleLiveReplayPlay();
        return true;
      }
      return false;
    };
  }, [canStartLiveReplay, handleLiveReplayPause, handleLiveReplayPlay, isLiveReplayPlaying]);

  // Cleanup the live replay loop on unmount.
  useEffect(() => {
    return () => {
      stopLiveReplayLoop();
    };
  }, [stopLiveReplayLoop]);

  const renderPlayerBar = useCallback(
    (
      player: BughousePlayer,
      clockValue?: number,
      team?: "AWhite_BBlack" | "ABlack_BWhite",
      options: {
        /**
         * Whether this player is currently to-move for the relevant board.
         * Used for a subtle, always-correct visual indicator during analysis.
         */
        isToMove?: boolean;
        /**
         * When true, visually indicates the clocks are "frozen" because the cursor
         * is currently exploring a non-mainline variation.
         */
        clocksFrozen?: boolean;
        /**
         * Optional tiny corner material counter shown in the outer board corners.
         */
        cornerMaterial?: { value: number; corner: "top-left" | "top-right" | "bottom-left" | "bottom-right" };
      } = {},
    ) => {
      const diffDeciseconds = clockSnapshot ? getTeamTimeDiffDeciseconds(clockSnapshot) : 0;
      const tint =
        team && clockSnapshot
          ? getClockTintClasses({ diffDeciseconds, team, isFrozen: options.clocksFrozen })
          : null;
      const neutralText = options.clocksFrozen ? "text-white/55" : "text-white/90";
      /**
       * `isCompactLandscape` is tuned for phone-landscape (short viewport height), so it will not
       * trigger on iPad Mini landscape. However, iPad Mini can still yield relatively small boards
       * once we account for reserve columns + gaps, and at that point the player name bar needs
       * to “tighten up” earlier to avoid excessive truncation.
       */
      const NARROW_PLAYER_BAR_BOARD_SIZE_PX = 340;
      const HIDE_TITLE_BADGE_BOARD_SIZE_PX = 360;
      const HIDE_RATING_BOARD_SIZE_PX = 320;

      const isNarrowPlayerBar = boardSize <= NARROW_PLAYER_BAR_BOARD_SIZE_PX;
      const shouldHideTitleBadge = isCompactLandscape || boardSize <= HIDE_TITLE_BADGE_BOARD_SIZE_PX;
      const shouldHideRating = (isCompactLandscape && boardSize <= 235) || boardSize <= HIDE_RATING_BOARD_SIZE_PX;

      return (
        <div
          className={[
            "relative flex items-center justify-between w-full shrink-0 font-bold text-white",
            isNarrowPlayerBar ? "tracking-normal" : "tracking-wide",
            // On very small phone-landscape viewports, prioritize showing player names.
            isCompactLandscape
              ? "px-2 text-xs"
              : isNarrowPlayerBar
                ? "px-2 text-sm"
                : "px-3 text-base lg:text-xl",
          ].join(" ")}
          /**
           * Important invariant:
           * Keep player bars a fixed height across *all* states (pre-load, loaded, analysis variations),
           * otherwise the `justify-between` board columns will vertically offset the boards from each other.
           */
          style={{ width: boardSize, height: layout.nameBlockPx }}
        >
        {options.cornerMaterial ? (
          <BoardCornerMaterial
            value={options.cornerMaterial.value}
            corner={options.cornerMaterial.corner}
            density={isCompactLandscape || isNarrowPlayerBar ? "compact" : "default"}
          />
        ) : null}
        <div
          className={[
            "flex items-center min-w-0",
            isCompactLandscape || isNarrowPlayerBar ? "gap-1.5" : "gap-2",
          ].join(" ")}
        >
          <div
            className={[
              "flex items-center min-w-0",
              isCompactLandscape || isNarrowPlayerBar ? "gap-1.5" : "gap-2",
            ].join(" ")}
          >
            {/* On very small screens, titles consume too much horizontal space. */}
            {!shouldHideTitleBadge ? <ChessTitleBadge chessTitle={player.chessTitle} /> : null}
            <span
              className={[
                "truncate min-w-0",
                isCompactLandscape || isNarrowPlayerBar ? "text-[11px] leading-tight" : "",
              ].join(" ")}
              title={player.username}
            >
              {player.username}
            </span>
            {typeof player.rating === "number" &&
            Number.isFinite(player.rating) &&
            !shouldHideRating ? (
              <span
                className={[
                  "shrink-0 font-semibold text-white/60",
                  isCompactLandscape ? "text-[10px]" : "text-xs lg:text-sm",
                ].join(" ")}
              >
                ({Math.round(player.rating)})
              </span>
            ) : null}
          </div>
          <ChevronLeft
            aria-hidden
            className={[
              "shrink-0 text-mariner-300 transition-opacity",
              isCompactLandscape ? "h-4 w-4" : "h-5 w-5",
              options.isToMove ? "opacity-100" : "opacity-0",
            ].join(" ")}
          />
          {options.isToMove ? <span className="sr-only">To move</span> : null}
        </div>
        {shouldRenderClocks && typeof clockValue === "number" ? (
          <span
            className={[
              "font-mono text-base lg:text-lg tabular-nums rounded px-2 py-0.5 transition-colors",
              options.clocksFrozen
                ? "bg-gray-950/40"
                : "bg-transparent",
              tint ?? neutralText,
            ].join(" ")}
          >
            {options.clocksFrozen ? (
              <span className="sr-only">Clocks frozen (variation)</span>
            ) : null}
            {formatClock(clockValue)}
          </span>
        ) : (
          <span className="font-mono text-lg tabular-nums text-white/60" />
        )}
      </div>
      );
    },
    [boardSize, clockSnapshot, formatClock, isCompactLandscape, layout.nameBlockPx, shouldRenderClocks],
  );

  const getSideToMove = useCallback((fen: string): "white" | "black" => {
    const turn = new Chess(fen).turn();
    return turn === "w" ? "white" : "black";
  }, []);

  const sideToMoveA = useMemo(
    () => getSideToMove(currentPosition.fenA),
    [currentPosition.fenA, getSideToMove],
  );
  const sideToMoveB = useMemo(
    () => getSideToMove(currentPosition.fenB),
    [currentPosition.fenB, getSideToMove],
  );

  const handleDragStart = useCallback(
    (payload: { board: "A" | "B"; source: Square; piece: string }) => {
      if (isLiveReplayPlaying) {
        return false;
      }
      if (state.pendingPromotion) {
        // Promotion choice must be resolved before allowing further moves.
        return false;
      }
      if (state.pendingDrop) {
        // Avoid mixed interaction modes: cancel dragging while a drop is armed.
        return false;
      }
      const fen = payload.board === "A" ? currentPosition.fenA : currentPosition.fenB;
      const sideToMove = getSideToMove(fen);
      const pieceColor = payload.piece.startsWith("w") ? "white" : "black";
      if (pieceColor !== sideToMove) {
        return false;
      }

      // Compute legal destinations for this piece and surface them as UI highlights.
      // This only applies to board moves; reserve drops use a separate HTML5 DnD path.
      const chess = new Chess(fen);
      const moves = chess.moves({ square: payload.source, verbose: true }) as Array<{ to: string }>;
      const targets = moves
        .map((move) => move.to)
        .filter((square): square is Square => /^[a-h][1-8]$/.test(square));

      setDragLegalMoveHighlight(
        targets.length > 0
          ? { board: payload.board, fenAtDragStart: fen, from: payload.source, targets }
          : null,
      );
      return true;
    },
    [
      currentPosition.fenA,
      currentPosition.fenB,
      getSideToMove,
      isLiveReplayPlaying,
      state.pendingDrop,
      state.pendingPromotion,
    ],
  );

  const handleDragEnd = useCallback(() => {
    setDragLegalMoveHighlight(null);
  }, []);

  const handleAttemptMove = useCallback(
    (payload: { board: "A" | "B"; from: Square; to: Square; piece: string }) => {
      // The drag interaction ended (even if the move is rejected / snapback).
      setDragLegalMoveHighlight(null);

      if (isLiveReplayPlaying) {
        return "snapback";
      }

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
    [isLiveReplayPlaying, tryApplyMove],
  );

  const handleSquareClick = useCallback(
    (payload: { board: "A" | "B"; square: Square }) => {
      if (isLiveReplayPlaying) {
        return;
      }
      if (state.pendingPromotion) {
        toast("Choose a promotion piece first", { id: "promotion-pending", duration: 1400 });
        return;
      }
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
    [isLiveReplayPlaying, state.pendingDrop, state.pendingPromotion, tryApplyMove],
  );

  const handleReservePieceDragStart = useCallback(
    (
      board: "A" | "B",
      payload: { color: "white" | "black"; piece: "p" | "n" | "b" | "r" | "q" },
    ) => {
      if (isLiveReplayPlaying) {
        return false;
      }
      if (state.pendingPromotion) {
        toast("Choose a promotion piece first", { id: "promotion-pending", duration: 1400 });
        return false;
      }
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
    [
      currentPosition.fenA,
      currentPosition.fenB,
      getSideToMove,
      isLiveReplayPlaying,
      setPendingDrop,
      state.pendingPromotion,
    ],
  );

  const handleReservePieceDragEnd = useCallback(() => {
    if (isLiveReplayPlaying) return;
    // Clear pending-drop state after drag ends (successful or cancelled).
    setPendingDrop(null);
  }, [isLiveReplayPlaying, setPendingDrop]);

  const handleAttemptReserveDrop = useCallback(
    (payload: {
      board: "A" | "B";
      to: Square;
      side: "white" | "black";
      piece: "p" | "n" | "b" | "r" | "q";
    }) => {
      if (isLiveReplayPlaying) {
        return "snapback";
      }
      if (state.pendingPromotion) {
        toast("Choose a promotion piece first", { id: "promotion-pending", duration: 1400 });
        return "snapback";
      }
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
    [
      currentPosition.fenA,
      currentPosition.fenB,
      getSideToMove,
      isLiveReplayPlaying,
      setPendingDrop,
      state.pendingPromotion,
      tryApplyMove,
    ],
  );

  const handleReservePieceClick = useCallback(
    (board: "A" | "B", payload: { color: "white" | "black"; piece: "p" | "n" | "b" | "r" | "q" }) => {
      if (isLiveReplayPlaying) {
        return;
      }
      if (state.pendingPromotion) {
        toast("Choose a promotion piece first", { id: "promotion-pending", duration: 1400 });
        return;
      }
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
    [
      currentPosition.fenA,
      currentPosition.fenB,
      getSideToMove,
      isLiveReplayPlaying,
      setPendingDrop,
      state.pendingDrop,
      state.pendingPromotion,
    ],
  );

  return (
    <div
      ref={analysisContainerRef}
      className={[
        "w-full mx-auto min-w-0 flex min-[1400px]:h-auto",
        isCompactLandscape ? "h-auto overflow-visible" : "h-full min-h-0 overflow-hidden",
      ].join(" ")}
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
      <div
        className={[
          "flex min-w-0 flex-col min-[1400px]:flex-row justify-center items-center min-[1400px]:items-start",
          isCompactLandscape ? "gap-3" : "gap-6",
          // In default modes the analysis shell is viewport-clamped, so the inner layout uses flex-1.
          isCompactLandscape ? "" : "flex-1 min-h-0",
        ].join(" ")}
      >
        {/* Left Column: Boards + Controls */}
        <div
          className={[
            "flex flex-col items-center min-w-0 relative w-full min-[1400px]:w-auto min-[1400px]:grow",
            isCompactLandscape ? "gap-2" : "gap-4",
          ].join(" ")}
        >
          {state.pendingPromotion && (
            <PromotionPicker
              board={state.pendingPromotion.board}
              to={state.pendingPromotion.to}
              side={state.pendingPromotion.board === "A" ? sideToMoveA : sideToMoveB}
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
            className={[
              "flex w-full justify-center items-stretch min-w-0",
              isCompactLandscape ? "gap-2" : "gap-4",
            ].join(" ")}
            style={{ height: playAreaHeight }}
          >
            {/* Left Reserves (Board A) */}
            <div className="flex flex-col justify-start shrink-0 w-16 h-full">
              <PieceReserveVertical
                whiteReserves={currentPosition.reserves.A.white}
                blackReserves={currentPosition.reserves.A.black}
                bottomColor={isBoardsFlipped ? "black" : "white"}
                height={reserveHeight}
                density={isCompactLandscape ? "compact" : "default"}
                disabled={isLiveReplayPlaying}
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
            <div
              className={[
                "flex flex-col items-center justify-between h-full",
                isCompactLandscape ? "py-1 gap-1" : "py-2 gap-2",
              ].join(" ")}
            >
              {isBoardsFlipped
                ? renderPlayerBar(players.aWhite, clockSnapshot?.A.white, "AWhite_BBlack", {
                    isToMove: sideToMoveA === "white",
                    clocksFrozen: areClocksFrozen,
                    cornerMaterial: {
                      value: currentPosition.captureMaterial.A[isBoardsFlipped ? "white" : "black"],
                      corner: "top-left",
                    },
                  })
                : renderPlayerBar(players.aBlack, clockSnapshot?.A.black, "ABlack_BWhite", {
                    isToMove: sideToMoveA === "black",
                    clocksFrozen: areClocksFrozen,
                    cornerMaterial: {
                      value: currentPosition.captureMaterial.A[isBoardsFlipped ? "white" : "black"],
                      corner: "top-left",
                    },
                  })}
              <ChessBoard
                fen={currentPosition.fenA}
                boardName="A"
                size={boardSize}
                flip={isBoardsFlipped}
                annotations={boardAAnnotations}
                onAnnotationsChange={handleBoardAAnnotationsChange}
                promotedSquares={currentPosition.promotedSquares.A}
                lastMoveFromSquare={
                  lastMoveHighlightsByBoard.A?.from ?? null
                }
                lastMoveToSquare={
                  lastMoveHighlightsByBoard.A?.to ?? null
                }
                dropCursorActive={Boolean(state.pendingDrop && state.pendingDrop.board === "A")}
                dragSourceSquare={
                  dragLegalMoveHighlight?.board === "A" && dragLegalMoveHighlight.fenAtDragStart === currentPosition.fenA
                    ? dragLegalMoveHighlight.from
                    : null
                }
                dragLegalTargets={
                  dragLegalMoveHighlight?.board === "A" && dragLegalMoveHighlight.fenAtDragStart === currentPosition.fenA
                    ? dragLegalMoveHighlight.targets
                    : []
                }
                draggable={!isLiveReplayPlaying}
                interactionsEnabled={!isLiveReplayPlaying}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onAttemptMove={handleAttemptMove}
                onSquareClick={handleSquareClick}
                onAttemptReserveDrop={handleAttemptReserveDrop}
              />
              {isBoardsFlipped
                ? renderPlayerBar(players.aBlack, clockSnapshot?.A.black, "ABlack_BWhite", {
                    isToMove: sideToMoveA === "black",
                    clocksFrozen: areClocksFrozen,
                    cornerMaterial: {
                      value: currentPosition.captureMaterial.A[isBoardsFlipped ? "black" : "white"],
                      corner: "bottom-left",
                    },
                  })
                : renderPlayerBar(players.aWhite, clockSnapshot?.A.white, "AWhite_BBlack", {
                    isToMove: sideToMoveA === "white",
                    clocksFrozen: areClocksFrozen,
                    cornerMaterial: {
                      value: currentPosition.captureMaterial.A[isBoardsFlipped ? "black" : "white"],
                      corner: "bottom-left",
                    },
                  })}
            </div>

            {/* Board B */}
            <div
              className={[
                "flex flex-col items-center justify-between h-full",
                isCompactLandscape ? "py-1 gap-1" : "py-2 gap-2",
              ].join(" ")}
            >
              {isBoardsFlipped
                ? renderPlayerBar(players.bBlack, clockSnapshot?.B.black, "AWhite_BBlack", {
                    isToMove: sideToMoveB === "black",
                    clocksFrozen: areClocksFrozen,
                    cornerMaterial: {
                      value: currentPosition.captureMaterial.B[isBoardsFlipped ? "black" : "white"],
                      corner: "top-right",
                    },
                  })
                : renderPlayerBar(players.bWhite, clockSnapshot?.B.white, "ABlack_BWhite", {
                    isToMove: sideToMoveB === "white",
                    clocksFrozen: areClocksFrozen,
                    cornerMaterial: {
                      value: currentPosition.captureMaterial.B[isBoardsFlipped ? "black" : "white"],
                      corner: "top-right",
                    },
                  })}
              <ChessBoard
                fen={currentPosition.fenB}
                boardName="B"
                size={boardSize}
                flip={!isBoardsFlipped}
                annotations={boardBAnnotations}
                onAnnotationsChange={handleBoardBAnnotationsChange}
                promotedSquares={currentPosition.promotedSquares.B}
                lastMoveFromSquare={
                  lastMoveHighlightsByBoard.B?.from ?? null
                }
                lastMoveToSquare={
                  lastMoveHighlightsByBoard.B?.to ?? null
                }
                dropCursorActive={Boolean(state.pendingDrop && state.pendingDrop.board === "B")}
                dragSourceSquare={
                  dragLegalMoveHighlight?.board === "B" && dragLegalMoveHighlight.fenAtDragStart === currentPosition.fenB
                    ? dragLegalMoveHighlight.from
                    : null
                }
                dragLegalTargets={
                  dragLegalMoveHighlight?.board === "B" && dragLegalMoveHighlight.fenAtDragStart === currentPosition.fenB
                    ? dragLegalMoveHighlight.targets
                    : []
                }
                draggable={!isLiveReplayPlaying}
                interactionsEnabled={!isLiveReplayPlaying}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onAttemptMove={handleAttemptMove}
                onSquareClick={handleSquareClick}
                onAttemptReserveDrop={handleAttemptReserveDrop}
              />
              {isBoardsFlipped
                ? renderPlayerBar(players.bWhite, clockSnapshot?.B.white, "ABlack_BWhite", {
                    isToMove: sideToMoveB === "white",
                    clocksFrozen: areClocksFrozen,
                    cornerMaterial: {
                      value: currentPosition.captureMaterial.B[isBoardsFlipped ? "white" : "black"],
                      corner: "bottom-right",
                    },
                  })
                : renderPlayerBar(players.bBlack, clockSnapshot?.B.black, "AWhite_BBlack", {
                    isToMove: sideToMoveB === "black",
                    clocksFrozen: areClocksFrozen,
                    cornerMaterial: {
                      value: currentPosition.captureMaterial.B[isBoardsFlipped ? "white" : "black"],
                      corner: "bottom-right",
                    },
                  })}
            </div>

            {/* Right Reserves (Board B) */}
            <div className="flex flex-col justify-start shrink-0 w-16 h-full">
              <PieceReserveVertical
                whiteReserves={currentPosition.reserves.B.white}
                blackReserves={currentPosition.reserves.B.black}
                bottomColor={isBoardsFlipped ? "white" : "black"}
                height={reserveHeight}
                density={isCompactLandscape ? "compact" : "default"}
                disabled={isLiveReplayPlaying}
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
            ref={controlsContainerRef}
            className="relative flex items-center justify-center"
            style={{ width: controlsWidth }}
          >
            {/* Live replay controls: bottom-left of the board controls area. */}
            <div className="absolute left-1 bottom-0 inline-flex items-center gap-2">
              <TooltipAnchor content={liveReplayPlayButtonTooltip}>
                <button
                  onClick={isLiveReplayPlaying ? handleLiveReplayPause : handleLiveReplayPlay}
                  disabled={!isLiveReplayPlaying && !canStartLiveReplay}
                  className={controlButtonBaseClass}
                  aria-label={isLiveReplayPlaying ? "Pause live replay" : "Play live replay"}
                  type="button"
                >
                  {isLiveReplayPlaying ? (
                    <Pause aria-hidden className={layout.controlIconSizeClass} />
                  ) : (
                    <Play aria-hidden className={layout.controlIconSizeClass} />
                  )}
                </button>
              </TooltipAnchor>
            </div>

            <div className={["flex items-center", isCompactLandscape ? "gap-2" : "gap-3"].join(" ")}>
              <TooltipAnchor content="Jump to start (↑)">
                <button
                  onClick={handleStart}
                  disabled={!canGoBack || isLiveReplayPlaying}
                  className={controlButtonBaseClass}
                  aria-label="Jump to start"
                  type="button"
                >
                  <SkipBack aria-hidden className={layout.controlIconSizeClass} />
                </button>
              </TooltipAnchor>
              <TooltipAnchor content="Previous move (←)">
                <button
                  onClick={handlePrevious}
                  disabled={!canGoBack}
                  className={controlButtonBaseClass}
                  aria-label="Previous move"
                  type="button"
                >
                  <StepBack aria-hidden className={layout.controlIconSizeClass} />
                </button>
              </TooltipAnchor>
              <TooltipAnchor content="Next move (→)">
                <button
                  onClick={handleNext}
                  disabled={!canGoForward}
                  className={controlButtonBaseClass}
                  aria-label="Next move"
                  type="button"
                >
                  <StepForward aria-hidden className={layout.controlIconSizeClass} />
                </button>
              </TooltipAnchor>
              <TooltipAnchor content="Jump to end (↓)">
                <button
                  onClick={handleEnd}
                  disabled={!canGoForward || isLiveReplayPlaying}
                  className={controlButtonBaseClass}
                  aria-label="Jump to end"
                  type="button"
                >
                  <SkipForward aria-hidden className={layout.controlIconSizeClass} />
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
                <RefreshCcw aria-hidden className={layout.controlIconSizeClass} />
              </button>
            </TooltipAnchor>
          </div>
        </div>

        {/* Right Column: Move list placeholder (MoveTree lands next) */}
        <div
          className={[
            // Stacked / tablet: full width under the boards.
            "w-full min-w-0 overflow-x-hidden",
            // Default (viewport-clamped): consume remaining height so the move list is always visible.
            isCompactLandscape ? "shrink-0" : "flex-1 min-h-0",
            // Desktop: fixed right column, height aligned to board play area.
            "min-[1400px]:flex-none min-[1400px]:shrink-0 min-[1400px]:w-[360px] min-[1400px]:h-(--bh-play-area-height)",
            // Compact landscape: give the move list a bounded height so it can scroll internally
            // after the user scrolls down to it.
            isCompactLandscape ? "h-[280px] max-h-[60vh]" : "",
          ].join(" ")}
        >
          <MoveListWithVariations
            tree={state.tree}
            cursorNodeId={state.cursorNodeId}
            selectedNodeId={state.selectedNodeId}
            players={players}
            combinedMoves={combinedMovesForMoveTimes}
            combinedMoveDurations={combinedMoveDurationsForMoveTimes}
            footer={moveListFooter}
            disabled={isLiveReplayPlaying}
            onSelectNode={selectNode}
            onPromoteVariationOneLevel={promoteVariationOneLevel}
            onTruncateAfterNode={truncateAfterNode}
            onTruncateFromNodeInclusive={truncateFromNodeInclusive}
          />
        </div>
      </div>
    </div>
  );
};

export default BughouseAnalysis;
