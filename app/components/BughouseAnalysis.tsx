"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import {
  ChevronLeft,
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
import { getClockTintClasses, getTeamTimeDiffDeciseconds } from "../utils/clockAdvantage";
import {
  createInitialPositionSnapshot,
  validateAndApplyMoveFromNotation,
} from "../utils/analysis/applyMove";
import ChessBoard from "./ChessBoard";
import PieceReserveVertical from "./PieceReserveVertical";
import { useAnalysisState } from "./useAnalysisState";
import VariationSelector from "./VariationSelector";
import PromotionPicker from "./PromotionPicker";
import MoveListWithVariations from "./MoveListWithVariations";
import { TooltipAnchor } from "./TooltipAnchor";
import type { BoardAnnotations } from "../utils/boardAnnotations";
import {
  createEmptyBoardAnnotationsByFen,
  getAnnotationsForFen,
  setAnnotationsForFen,
  toFenKey,
} from "../utils/boardAnnotationPersistence";

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

  // Responsive board sizing (same approach as the replay UI).
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
        const containerHeight = analysisContainerRef.current?.clientHeight ?? 0;
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
    if (analysisContainerRef.current) {
      resizeObserver.observe(analysisContainerRef.current);
    }
    if (controlsContainerRef.current) {
      resizeObserver.observe(controlsContainerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, []);

  const processedGame = useMemo(() => {
    if (!gameData) return null;
    return processGameData(gameData.original, gameData.partner);
  }, [gameData]);

  const players = processedGame?.players ?? PLACEHOLDER_PLAYERS;
  const shouldRenderClocks = Boolean(processedGame);

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

    const sanitized: BughouseMove[] = [];
    let position = createInitialPositionSnapshot();

    for (const combinedMove of processedGame.combinedMoves) {
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

  const combinedMoveDurationsForMoveTimes = useMemo((): number[] | undefined => {
    if (!processedGame?.combinedMoves?.length) return undefined;
    return buildBughouseClockTimeline(processedGame).moveDurationsByGlobalIndex;
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

  const playAreaHeight = boardSize + NAME_BLOCK * 2 + COLUMN_PADDING * 2;
  const reserveHeight = playAreaHeight;
  const controlsWidth = boardSize * 2 + RESERVE_COLUMN_WIDTH_PX * 2 + GAP_PX * 3;

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

    const { timeline } = buildBughouseClockTimeline(processedGame);
    const plyCount = getGlobalPlyCountAtNode(effectiveClockNodeId);
    const clampedIndex = Math.min(Math.max(plyCount, 0), timeline.length - 1);
    return timeline[clampedIndex];
  }, [effectiveClockNodeId, getGlobalPlyCountAtNode, processedGame]);

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
      } = {},
    ) => {
      const diffDeciseconds = clockSnapshot ? getTeamTimeDiffDeciseconds(clockSnapshot) : 0;
      const tint =
        team && clockSnapshot
          ? getClockTintClasses({ diffDeciseconds, team, isFrozen: options.clocksFrozen })
          : null;
      const neutralText = options.clocksFrozen ? "text-white/55" : "text-white/90";

      return (
        <div
          className="flex items-center justify-between w-full px-3 text-lg lg:text-xl font-bold text-white tracking-wide"
          style={{ width: boardSize }}
        >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate min-w-0" title={player.username}>
              {player.username}
            </span>
            {typeof player.rating === "number" && Number.isFinite(player.rating) && (
              <span className="shrink-0 text-xs lg:text-sm font-semibold text-white/60">
                ({Math.round(player.rating)})
              </span>
            )}
          </div>
          {options.isToMove ? (
            <>
              <ChevronLeft aria-hidden className="h-5 w-5 shrink-0 text-mariner-300" />
              <span className="sr-only">To move</span>
            </>
          ) : null}
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
    [boardSize, clockSnapshot, formatClock, shouldRenderClocks],
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

  const handleDragStart = useCallback(
    (payload: { board: "A" | "B"; source: Square; piece: string }) => {
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
    [currentPosition.fenA, currentPosition.fenB, getSideToMove, state.pendingDrop, state.pendingPromotion],
  );

  const handleDragEnd = useCallback(() => {
    setDragLegalMoveHighlight(null);
  }, []);

  const handleAttemptMove = useCallback(
    (payload: { board: "A" | "B"; from: Square; to: Square; piece: string }) => {
      // The drag interaction ended (even if the move is rejected / snapback).
      setDragLegalMoveHighlight(null);

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
    [tryApplyMove],
  );

  const handleSquareClick = useCallback(
    (payload: { board: "A" | "B"; square: Square }) => {
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
    [state.pendingDrop, state.pendingPromotion, tryApplyMove],
  );

  const handleReservePieceDragStart = useCallback(
    (
      board: "A" | "B",
      payload: { color: "white" | "black"; piece: "p" | "n" | "b" | "r" | "q" },
    ) => {
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
    [currentPosition.fenA, currentPosition.fenB, getSideToMove, setPendingDrop, state.pendingPromotion],
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
      setPendingDrop,
      state.pendingPromotion,
      tryApplyMove,
    ],
  );

  const handleReservePieceClick = useCallback(
    (board: "A" | "B", payload: { color: "white" | "black"; piece: "p" | "n" | "b" | "r" | "q" }) => {
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
      setPendingDrop,
      state.pendingDrop,
      state.pendingPromotion,
    ],
  );

  return (
    <div
      ref={analysisContainerRef}
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
        <div className="flex flex-col items-center gap-4 min-w-0 relative w-full min-[1400px]:w-auto min-[1400px]:grow">
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
            className="flex w-full gap-4 justify-center items-stretch min-w-0"
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
                ? renderPlayerBar(players.aWhite, clockSnapshot?.A.white, "AWhite_BBlack", {
                    isToMove: sideToMoveA === "white",
                    clocksFrozen: areClocksFrozen,
                  })
                : renderPlayerBar(players.aBlack, clockSnapshot?.A.black, "ABlack_BWhite", {
                    isToMove: sideToMoveA === "black",
                    clocksFrozen: areClocksFrozen,
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
                draggable
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
                  })
                : renderPlayerBar(players.aWhite, clockSnapshot?.A.white, "AWhite_BBlack", {
                    isToMove: sideToMoveA === "white",
                    clocksFrozen: areClocksFrozen,
                  })}
            </div>

            {/* Board B */}
            <div className="flex flex-col items-center justify-between h-full py-2 gap-2">
              {isBoardsFlipped
                ? renderPlayerBar(players.bBlack, clockSnapshot?.B.black, "AWhite_BBlack", {
                    isToMove: sideToMoveB === "black",
                    clocksFrozen: areClocksFrozen,
                  })
                : renderPlayerBar(players.bWhite, clockSnapshot?.B.white, "ABlack_BWhite", {
                    isToMove: sideToMoveB === "white",
                    clocksFrozen: areClocksFrozen,
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
                draggable
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
                  })
                : renderPlayerBar(players.bBlack, clockSnapshot?.B.black, "AWhite_BBlack", {
                    isToMove: sideToMoveB === "black",
                    clocksFrozen: areClocksFrozen,
                  })}
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
            ref={controlsContainerRef}
            className="relative flex items-center justify-center"
            style={{ width: controlsWidth }}
          >
            <div className="flex items-center gap-3">
              <TooltipAnchor content="Jump to start (↑)">
                <button
                  onClick={handleStart}
                  disabled={!canGoBack}
                  className={controlButtonBaseClass}
                  aria-label="Jump to start"
                  type="button"
                >
                  <SkipBack aria-hidden className="h-5 w-5" />
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
                  <StepBack aria-hidden className="h-5 w-5" />
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
                  <StepForward aria-hidden className="h-5 w-5" />
                </button>
              </TooltipAnchor>
              <TooltipAnchor content="Jump to end (↓)">
                <button
                  onClick={handleEnd}
                  disabled={!canGoForward}
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

        {/* Right Column: Move list placeholder (MoveTree lands next) */}
        <div
          className={[
            // Stacked / tablet: full width under the boards, and consume remaining height.
            "w-full flex-1 min-h-0 min-w-0 overflow-x-hidden",
            // Desktop: fixed right column, height aligned to board play area.
            "min-[1400px]:flex-none min-[1400px]:shrink-0 min-[1400px]:w-[360px] min-[1400px]:h-[var(--bh-play-area-height)]",
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

