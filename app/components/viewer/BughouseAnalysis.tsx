"use client";

/**
 * @module app/components/viewer/BughouseAnalysis
 *
 * Full analysis + live-replay viewer: interactive boards, variation tree move list,
 * clocks, reserves, annotations, and keyboard-driven navigation.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { Chess, type Square } from "chess.js";
import {
  ChevronLeft,
  Fullscreen,
  MessageSquareText,
  Pause,
  Play,
  RefreshCcw,
  Save,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
} from "lucide-react";
import toast from "react-hot-toast";
import type { ChessGame } from "../../actions";
import { processGameData } from "../../utils/board/moveOrdering";
import { deriveBughouseConclusionSummary } from "../../utils/board/gameConclusion";
import type { BughouseMove } from "../../types/bughouse";
import type { BughousePlayer } from "../../types/bughouse";
import type { AnalysisNode, BughouseBoardId, BughouseSide } from "../../types/analysis";
import { buildBughouseClockTimeline } from "../../utils/analysis/buildBughouseClockTimeline";
import { buildPerBoardMoveDurationsDeciseconds } from "../../utils/analysis/buildPerBoardMoveDurationsDeciseconds";
import { getClockTintClasses, getTeamTimeDiffDeciseconds } from "../../utils/board/clockAdvantage";
import {
  createInitialPositionSnapshot,
  validateAndApplyMoveFromNotation,
} from "../../utils/analysis/applyMove";
import ChessBoard from "../board/ChessBoard";
import PieceReserveVertical from "../board/PieceReserveVertical";
import { reorderSimultaneousCheckmateMove, useAnalysisState } from "../moves/useAnalysisState";
import VariationSelector from "../moves/VariationSelector";
import PromotionPicker from "../board/PromotionPicker";
import MoveListWithVariations from "../moves/MoveListWithVariations";
import { ChessTitleBadge } from "../badges/ChessTitleBadge";
import { TooltipAnchor } from "../ui/TooltipAnchor";
import { BoardCornerMaterial } from "../board/BoardCornerMaterial";
import type { BoardAnnotations } from "../../utils/board/boardAnnotations";
import {
  createEmptyBoardAnnotationsByFen,
  getAnnotationsForFen,
  setAnnotationsForFen,
  toFenKey,
} from "../../utils/board/boardAnnotationPersistence";
import {
  buildBughouseBoardMoveCountsByGlobalPly,
  buildMonotonicMoveTimestampsDeciseconds,
  getBughouseClockSnapshotAtElapsedDeciseconds,
  getLiveReplayElapsedDecisecondsAtGlobalPly,
  isPristineLoadedMainline,
} from "../../utils/analysis/liveReplay";
import { useCompactLandscape } from "../../utils/platform/useCompactLandscape";
import { useFirebaseAnalytics, logAnalyticsEvent } from "../../utils/platform/useFirebaseAnalytics";
import { getSharedGameDescriptionTooltip } from "../../utils/shared-games/sharedGameDescription";
import { useViewerOrientationStore } from "../../stores/viewerOrientationStore";
import {
  getBoardOrder,
  getDisplayBoardLabel,
  getPlayersForBoard,
} from "../../utils/board/boardOrderMapping";
import { clampPlyToMainlineBounds } from "../../utils/discovery/gameViewerUrlState";
import { usePieceValuePreset } from "../../utils/preferences/usePieceValuePreset";

/** Props for the main dual-board analysis surface. */
interface BughouseAnalysisProps {
  gameData?: {
    original: ChessGame;
    partner: ChessGame | null;
  } | null;
  /**
   * Optional 0-based global ply parsed from URL.
   * When provided, the viewer will jump to this mainline position after loading.
   */
  initialGlobalPly?: number | null;
  isLoading?: boolean;
  /**
   * Optional externally-controlled board orientation.
   *
   * When provided, `BughouseAnalysis` becomes controlled for orientation (flip state):
   * - `boardsFlipped=false` means the (A White + B Black) partner pair is at the bottom.
   * - `boardsFlipped=true` means the (A Black + B White) partner pair is at the bottom.
   *
   * This is used by match replay to keep a stable "viewer perspective" across multiple games.
   */
  boardsFlipped?: boolean;
  /**
   * Called when the user requests an orientation change (flip button or `f` hotkey).
   *
   * When `boardsFlipped` is provided, the parent is responsible for updating it.
   */
  onBoardsFlippedChange?: (next: boolean) => void;
  /**
   * Pre-formatted "games analysed" label (e.g. `Games Analysed: 1,234`).
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
  /**
   * Called when the user clicks the share button.
   * The parent component handles the sharing logic and modal.
   */
  onShareClick?: () => void;
  /**
   * Called when the user chooses "Share game from this move" in the move list context menu.
   * Receives a 0-based global ply on the loaded mainline.
   */
  onShareGameFromPly?: (ply: number) => void;
  /**
   * Whether the share button should be enabled.
   * Typically true when a game is loaded AND user is fully authenticated.
   */
  canShare?: boolean;
  /**
   * Whether "Share game from this move" should be enabled in the move list context menu.
   */
  canShareFromMove?: boolean;
  /**
   * Tooltip message explaining why sharing is disabled (when canShare is false).
   */
  shareDisabledReason?: string;
  /**
   * Optional description from a shared game/match/series.
   * Only rendered when the viewer is opened via a shared link.
   */
  sharedGameDescription?: string | null;
  /**
   * Called once when a live replay finishes naturally (playhead reaches the end).
   */
  onLiveReplayCompleted?: () => void;
  /**
   * When true, attempt to auto-start live replay for the currently loaded game.
   */
  autoStartLiveReplay?: boolean;
}

/** Placeholder player names shown before a game is loaded. */
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
 * Fullscreen is intentionally a desktop-only enhancement. Requiring a primary pointer that can
 * hover keeps the control off phones and touch-first tablets, including wide landscape layouts.
 */
const DESKTOP_FULLSCREEN_MEDIA_QUERY = "(hover: hover) and (pointer: fine)";

/**
 * Interactive analysis experience for a two-board bughouse position:
 * - always renders both boards from first paint (start position when no game loaded)
 * - supports move entry + drops + nested variations (wired via analysis store)
 */
const BughouseAnalysis: React.FC<BughouseAnalysisProps> = ({
  gameData,
  initialGlobalPly,
  isLoading,
  boardsFlipped,
  onBoardsFlippedChange,
  gamesLoadedLabel,
  showGamesLoadedInline,
  onAnalysisDirtyChange,
  onShareClick,
  onShareGameFromPly,
  canShare,
  canShareFromMove,
  shareDisabledReason,
  sharedGameDescription,
  onLiveReplayCompleted,
  autoStartLiveReplay,
}) => {
  const analysisContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenPanelRef = useRef<HTMLDivElement>(null);
  const boardsContainerRef = useRef<HTMLDivElement>(null);
  const controlsContainerRef = useRef<HTMLDivElement>(null);
  const isCompactLandscape = useCompactLandscape();
  const analytics = useFirebaseAnalytics();
  const orientationStore = useViewerOrientationStore();
  const isBoardOrderSwapped = orientationStore.isBoardOrderSwapped;
  const pieceValuePreset = usePieceValuePreset();
  const [isDesktopFullscreenAvailable, setIsDesktopFullscreenAvailable] = useState(false);
  const [isBoardsFullscreen, setIsBoardsFullscreen] = useState(false);
  const handleToggleBoardOrder = useCallback(() => {
    orientationStore.toggleBoardOrder();
  }, [orientationStore]);

  useEffect(() => {
    const panel = fullscreenPanelRef.current;
    if (!panel || typeof window === "undefined") return;

    const media = window.matchMedia(DESKTOP_FULLSCREEN_MEDIA_QUERY);
    const updateAvailability = () => {
      const isAvailable =
        media.matches &&
        document.fullscreenEnabled &&
        typeof panel.requestFullscreen === "function";

      setIsDesktopFullscreenAvailable(isAvailable);

      // If a desktop window moves into a touch/mobile context while fullscreen, return to the
      // normal viewer rather than leaving an otherwise-unavailable mode active.
      if (!media.matches && document.fullscreenElement === panel) {
        void document.exitFullscreen().catch(() => undefined);
      }
    };
    const updateFullscreenState = () => {
      setIsBoardsFullscreen(document.fullscreenElement === panel);
    };

    updateAvailability();
    updateFullscreenState();
    media.addEventListener("change", updateAvailability);
    document.addEventListener("fullscreenchange", updateFullscreenState);

    return () => {
      media.removeEventListener("change", updateAvailability);
      document.removeEventListener("fullscreenchange", updateFullscreenState);
    };
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    const panel = fullscreenPanelRef.current;
    if (!panel || !isDesktopFullscreenAvailable) return;

    try {
      if (document.fullscreenElement === panel) {
        await document.exitFullscreen();
        logAnalyticsEvent(analytics, "analysis_fullscreen_toggled", { enabled: false });
        return;
      }

      await panel.requestFullscreen();
      logAnalyticsEvent(analytics, "analysis_fullscreen_toggled", { enabled: true });
    } catch {
      toast.error("Full screen could not be opened.");
    }
  }, [analytics, isDesktopFullscreenAvailable]);
  const { leftBoardId, rightBoardId } = getBoardOrder(isBoardOrderSwapped);
  const {
    state,
    currentPosition,
    selectNode,
    navBack,
    navForwardOrOpenSelector,
    loadGameMainline,
    promoteVariationOneLevel: promoteVariationOneLevelBase,
    truncateAfterNode: truncateAfterNodeBase,
    truncateFromNodeInclusive: truncateFromNodeInclusiveBase,
    closeVariationSelector,
    moveVariationSelectorIndex,
    setVariationSelectorIndex,
    acceptVariationSelector,
    tryApplyMove,
    setPendingDrop,
    commitPromotion: commitPromotionBase,
    cancelPendingPromotion,
  } = useAnalysisState(pieceValuePreset);

  // Wrap variation and promotion functions with analytics
  const promoteVariationOneLevel = useCallback(
    (nodeId: string) => {
      logAnalyticsEvent(analytics, "variation_promoted", {
        node_id: nodeId,
      });
      promoteVariationOneLevelBase(nodeId);
    },
    [analytics, promoteVariationOneLevelBase],
  );

  const truncateAfterNode = useCallback(
    (nodeId: string) => {
      logAnalyticsEvent(analytics, "variation_truncated", {
        truncation_type: "after",
        node_id: nodeId,
      });
      truncateAfterNodeBase(nodeId);
    },
    [analytics, truncateAfterNodeBase],
  );

  const truncateFromNodeInclusive = useCallback(
    (nodeId: string) => {
      logAnalyticsEvent(analytics, "variation_truncated", {
        truncation_type: "inclusive",
        node_id: nodeId,
      });
      truncateFromNodeInclusiveBase(nodeId);
    },
    [analytics, truncateFromNodeInclusiveBase],
  );

  const commitPromotion = useCallback(
    (piece: "q" | "r" | "b" | "n") => {
      const result = commitPromotionBase(piece);
      if (result.type === "ok") {
        logAnalyticsEvent(analytics, "promotion_committed", {
          piece: piece,
        });
      }
      return result;
    },
    [analytics, commitPromotionBase],
  );

  const [localBoardsFlipped, setLocalBoardsFlipped] = useState(false);
  const isBoardsFlipped = boardsFlipped ?? localBoardsFlipped;
  const lastAppliedInitialPlyKeyRef = useRef<string | null>(null);
  const pendingInitialPlyRef = useRef<{ gameId: string; ply: number } | null>(null);

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
    const next = !isBoardsFlipped;

    // Log analytics for board flip
    logAnalyticsEvent(analytics, "boards_flipped", {
      new_orientation: next ? "flipped" : "normal",
      context: "analysis",
    });

    if (boardsFlipped !== undefined) {
      onBoardsFlippedChange?.(next);
      return;
    }
    setLocalBoardsFlipped(next);
  }, [boardsFlipped, isBoardsFlipped, onBoardsFlippedChange, analytics]);

  /**
   * Responsive board sizing.
   *
   * Landscape keeps the paired boards together. CSS selects the arrangement and
   * density; its measured dimensions determine the square board size. Portrait
   * stacks boards when necessary, with notation reachable inside the viewer.
   */
  const layout = useMemo(() => ({
    controlButtonSizeClass: "h-10 w-10",
    controlIconSizeClass: "h-5 w-5",
  }), []);
  const [geometry, setGeometry] = useState({
    boardSize: 320,
    reserveWidth: 48,
    gap: 12,
    stacked: false,
    nameBlockHeight: 48,
    columnPadding: 8,
  });
  const { boardSize, nameBlockHeight, columnPadding } = geometry;

  useEffect(() => {
    const boards = boardsContainerRef.current;
    const analysis = analysisContainerRef.current;
    if (!boards || !analysis) return;

    // CSS owns layout modes; measure their actual space for chessboard.js, which needs pixels.
    const computeBoardSize = () => {
      const styles = window.getComputedStyle(boards);
      const reserveWidth = parseFloat(styles.getPropertyValue("--bh-reserve-width")) || 48;
      const gap = parseFloat(styles.columnGap) || 12;
      const stacked = styles.getPropertyValue("--bh-stack-boards").trim() === "1";
      const sideList = styles.getPropertyValue("--bh-side-list").trim() === "1";
      const widthCap = stacked
        ? boards.clientWidth - reserveWidth - gap
        : (boards.clientWidth - reserveWidth * 2 - gap * 3) / 2;
      const nameBlockHeight = parseFloat(styles.getPropertyValue("--bh-name-height")) || 48;
      const columnPadding = parseFloat(styles.getPropertyValue("--bh-column-padding")) || 8;
      const controlsHeight = controlsContainerRef.current?.clientHeight ?? 40;
      const panel = fullscreenPanelRef.current;
      const controlsGap = panel ? parseFloat(window.getComputedStyle(panel).rowGap) || 0 : 12;
      const chrome = nameBlockHeight * 2 + columnPadding * 2 + controlsHeight + controlsGap;
      let heightCap = Infinity;
      if (isBoardsFullscreen && fullscreenPanelRef.current) {
        const panel = fullscreenPanelRef.current;
        const padding = window.getComputedStyle(panel);
        const available = panel.clientHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom);
        heightCap = stacked ? (available - controlsHeight - controlsGap - gap) / 2 - nameBlockHeight * 2 - columnPadding * 2 : available - chrome;
      } else if (!stacked) {
        // Short windows may scroll rather than making the squares unusably small.
        const shortViewport = window.innerHeight <= 500;
        const notationSpace = sideList || shortViewport ? 0 : 180;
        heightCap = Math.max(shortViewport ? 80 : 220, analysis.clientHeight - chrome - notationSpace);
      }
      const next = { boardSize: Math.max(80, Math.floor(Math.min(widthCap, heightCap))), reserveWidth, gap, stacked, nameBlockHeight, columnPadding };
      setGeometry(previous => Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
    };
    computeBoardSize();
    const observer = new ResizeObserver(computeBoardSize);
    observer.observe(boards);
    observer.observe(analysis);
    if (controlsContainerRef.current) observer.observe(controlsContainerRef.current);
    if (fullscreenPanelRef.current) observer.observe(fullscreenPanelRef.current);
    window.addEventListener("resize", computeBoardSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", computeBoardSize);
    };
  }, [isBoardsFullscreen, isCompactLandscape]);

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
  const lastAutoStartGameIdRef = useRef<string | null>(null);

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

    const displaySourceBoard = getDisplayBoardLabel(
      summary.sourceBoard === "B" ? "B" : "A",
      isBoardOrderSwapped,
    );

    return (
      <div className="px-3 py-2">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[10px] uppercase tracking-wider text-gray-400">
            Game result
          </div>
          <div className="text-[10px] text-gray-500">
            Source: Board {displaySourceBoard}
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
  }, [
    gameData,
    gamesLoadedLabel,
    isBoardOrderSwapped,
    mainlineMoveCount,
    processedGame,
    showGamesLoadedInline,
  ]);

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
      lastAppliedInitialPlyKeyRef.current = null;
      pendingInitialPlyRef.current = null;
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
      pendingInitialPlyRef.current = null;
      return;
    }

    if (typeof initialGlobalPly === "number" && Number.isFinite(initialGlobalPly)) {
      const clampedPly = clampPlyToMainlineBounds(
        initialGlobalPly,
        processedGame.combinedMoves.length,
      );
      const applyKey = `${gameId}:${clampedPly}`;
      if (lastAppliedInitialPlyKeyRef.current !== applyKey) {
        pendingInitialPlyRef.current = { gameId, ply: clampedPly };
      } else {
        pendingInitialPlyRef.current = null;
      }
    } else {
      pendingInitialPlyRef.current = null;
    }
  }, [gameData, initialGlobalPly, loadGameMainline, processedGame]);

  useEffect(() => {
    const pendingInitialPly = pendingInitialPlyRef.current;
    if (!pendingInitialPly) return;
    const activeGameId = gameData?.original?.game?.id?.toString() ?? null;
    if (!activeGameId || activeGameId !== pendingInitialPly.gameId) return;

    let targetNodeId = state.tree.rootId;
    let reachedRequestedPly = true;
    for (let i = 0; i < pendingInitialPly.ply; i += 1) {
      const nextNodeId = state.tree.nodesById[targetNodeId]?.mainChildId ?? null;
      if (!nextNodeId) {
        reachedRequestedPly = false;
        break;
      }
      targetNodeId = nextNodeId;
    }

    // Tree replacement from `loadGameMainline` is async; wait until requested ply exists.
    if (!reachedRequestedPly) return;

    selectNode(targetNodeId);
    lastAppliedInitialPlyKeyRef.current = `${pendingInitialPly.gameId}:${pendingInitialPly.ply}`;
    pendingInitialPlyRef.current = null;
  }, [gameData, selectNode, state.tree.nodesById, state.tree.rootId]);

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

      // Swapping left/right board order.
      if (event.key.toLowerCase() === "s") {
        if (handleToggleBoardOrder) {
          event.preventDefault();
          handleToggleBoardOrder();
          return;
        }
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
    handleToggleBoardOrder,
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

  const playAreaHeight = boardSize + nameBlockHeight * 2 + columnPadding * 2;
  const reserveHeight = playAreaHeight;
  const controlsWidth =
    geometry.stacked ? boardSize + geometry.reserveWidth + geometry.gap : boardSize * 2 + geometry.reserveWidth * 2 + geometry.gap * 3;

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

  const mainlinePlyByNodeId = useMemo(() => {
    const map = new Map<string, number>();
    mainlineNodeIdsByGlobalPly.forEach((nodeId, ply) => {
      map.set(nodeId, ply);
    });
    return map;
  }, [mainlineNodeIdsByGlobalPly]);

  const handleShareGameFromNode = useCallback((nodeId: string) => {
    if (!onShareGameFromPly || !canShareFromMove) return;
    const ply = mainlinePlyByNodeId.get(nodeId);
    if (typeof ply !== "number" || !Number.isFinite(ply) || ply < 0) return;
    onShareGameFromPly(ply);
  }, [canShareFromMove, mainlinePlyByNodeId, onShareGameFromPly]);

  const canShareGameFromNode = useCallback((nodeId: string) => {
    if (!onShareGameFromPly || !canShareFromMove) return false;
    return mainlinePlyByNodeId.has(nodeId);
  }, [canShareFromMove, mainlinePlyByNodeId, onShareGameFromPly]);

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
      const result = seekLiveReplayToGlobalPly(currentPly + delta);
      if (result) {
        logAnalyticsEvent(analytics, "live_replay_seek", {
          direction: delta === 1 ? "forward" : "backward",
          from_ply: currentPly,
          to_ply: currentPly + delta,
        });
      }
      return result;
    },
    [getGlobalPlyCountAtNode, seekLiveReplayToGlobalPly, state.cursorNodeId, analytics],
  );

  // Keep a stable, always-up-to-date seek handler so the keyboard effect can call it
  // without being reordered around live replay callbacks.
  useEffect(() => {
    liveReplaySeekDeltaRef.current = seekLiveReplayByDelta;
  }, [seekLiveReplayByDelta]);

  const handleStart = useCallback(() => {
    logAnalyticsEvent(analytics, "navigation_control", {
      action: "jump_to_start",
    });
    selectNode(state.tree.rootId);
  }, [selectNode, state.tree.rootId, analytics]);

  const handlePrevious = useCallback(() => {
    if (isLiveReplayPlaying) {
      seekLiveReplayByDelta(-1);
      return;
    }
    logAnalyticsEvent(analytics, "navigation_control", {
      action: "previous_move",
    });
    navBack();
  }, [isLiveReplayPlaying, navBack, seekLiveReplayByDelta, analytics]);

  const handleNext = useCallback(() => {
    if (isLiveReplayPlaying) {
      seekLiveReplayByDelta(1);
      return;
    }
    logAnalyticsEvent(analytics, "navigation_control", {
      action: "next_move",
    });
    navForwardOrOpenSelector();
  }, [isLiveReplayPlaying, navForwardOrOpenSelector, seekLiveReplayByDelta, analytics]);

  const handleEnd = useCallback(() => {
    logAnalyticsEvent(analytics, "navigation_control", {
      action: "jump_to_end",
    });
    let nodeId = state.cursorNodeId;
    while (true) {
      const node = state.tree.nodesById[nodeId];
      if (!node?.mainChildId) break;
      nodeId = node.mainChildId;
    }
    selectNode(nodeId);
  }, [selectNode, state.cursorNodeId, state.tree.nodesById, analytics]);

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

  const sharedGameDescriptionTooltip = getSharedGameDescriptionTooltip(sharedGameDescription);

  const handleLiveReplayPause = useCallback(() => {
    logAnalyticsEvent(analytics, "live_replay_paused", {
      elapsed_deciseconds: liveReplayElapsedDeciseconds,
    });
    stopLiveReplayLoop();
    setLiveReplayStatus("idle");
  }, [stopLiveReplayLoop, analytics, liveReplayElapsedDeciseconds]);

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

    // Log analytics for live replay play
    logAnalyticsEvent(analytics, "live_replay_play", {
      start_ply: plyAtCursor,
      total_moves: combinedMovesForMoveTimes.length,
    });

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

          // Log analytics for live replay completion
          logAnalyticsEvent(analytics, "live_replay_completed", {
            total_moves: monotonicMoveTimestampsDeciseconds.length,
            total_duration_deciseconds: lastTimestamp,
          });

          onLiveReplayCompleted?.();

          return;
        }
      }

      liveReplayRafIdRef.current = window.requestAnimationFrame(tick);
    };

    liveReplayRafIdRef.current = window.requestAnimationFrame(tick);
  }, [analytics, boardMoveCountsByGlobalPly, closeVariationSelector, combinedMovesForMoveTimes, getGlobalPlyCountAtNode, isCursorOnMainline, liveReplayEligible, mainlineNodeIdsByGlobalPly, monotonicMoveTimestampsDeciseconds, onLiveReplayCompleted, processedGame, selectNode, setPendingDrop, state.cursorNodeId, state.pendingPromotion, stopLiveReplayLoop]);

  const currentGameId = gameData?.original?.game?.id?.toString() ?? null;

  /**
   * Auto-start live replay when requested by the parent (e.g., match auto-advance).
   */
  useEffect(() => {
    if (!autoStartLiveReplay) return;
    if (!currentGameId) return;
    if (!canStartLiveReplay) return;
    if (lastAutoStartGameIdRef.current === currentGameId) return;

    const timeoutId = window.setTimeout(() => {
      handleLiveReplayPlay();
      lastAutoStartGameIdRef.current = currentGameId;
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [autoStartLiveReplay, canStartLiveReplay, currentGameId, handleLiveReplayPlay]);

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
      const isNarrowPlayerBar = boardSize < 340;
      return (
        <div
          className="bh-player-bar relative text-white"
          data-compact={isNarrowPlayerBar ? "true" : "false"}
          data-material-edge={options.cornerMaterial?.corner.startsWith("top") ? "top" : options.cornerMaterial ? "bottom" : undefined}
          style={{ width: boardSize, height: nameBlockHeight, "--bh-player-font": `${Math.max(12, Math.min(18, boardSize / 24))}px` } as React.CSSProperties}
        >
        {options.cornerMaterial ? (
          <BoardCornerMaterial
            value={options.cornerMaterial.value}
            corner={options.cornerMaterial.corner}
            density={isCompactLandscape || isNarrowPlayerBar ? "compact" : "default"}
          />
        ) : null}
        <div className="bh-player-identity">
          <div className="bh-player-details">
            <ChessTitleBadge chessTitle={player.chessTitle} />
            <span className="bh-player-name" title={player.username} tabIndex={0}>
              {player.username}
            </span>
            {typeof player.rating === "number" && Number.isFinite(player.rating) ? (
              <span className="bh-player-rating">({Math.round(player.rating)})</span>
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
              "bh-player-clock font-mono tabular-nums rounded transition-colors",
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
    [boardSize, clockSnapshot, formatClock, isCompactLandscape, nameBlockHeight, shouldRenderClocks],
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
        // Log analytics for successful move
        logAnalyticsEvent(analytics, "move_applied", {
          move_type: "normal",
          board: payload.board,
        });
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
    [analytics, isLiveReplayPlaying, tryApplyMove],
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
        // Log analytics for successful drop
        logAnalyticsEvent(analytics, "move_applied", {
          move_type: "drop",
          board: payload.board,
          piece: pending.piece,
        });
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
    [isLiveReplayPlaying, state.pendingDrop, state.pendingPromotion, tryApplyMove, analytics],
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
        // Log analytics for successful drop
        logAnalyticsEvent(analytics, "move_applied", {
          move_type: "drop",
          board: payload.board,
          piece: payload.piece,
        });
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
      analytics,
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

  const getTeamForBoardSide = useCallback(
    (boardId: BughouseBoardId, side: BughouseSide): "AWhite_BBlack" | "ABlack_BWhite" => {
      if (boardId === "A") {
        return side === "white" ? "AWhite_BBlack" : "ABlack_BWhite";
      }
      return side === "white" ? "ABlack_BWhite" : "AWhite_BBlack";
    },
    [],
  );

  const getBoardDisplayConfig = useCallback(
    (boardId: BughouseBoardId) => {
      const isBoardA = boardId === "A";
      const topSide: BughouseSide = isBoardA
        ? isBoardsFlipped
          ? "white"
          : "black"
        : isBoardsFlipped
          ? "black"
          : "white";
      const bottomSide: BughouseSide = topSide === "white" ? "black" : "white";
      const flip = isBoardA ? isBoardsFlipped : !isBoardsFlipped;
      const reserves = isBoardA ? currentPosition.reserves.A : currentPosition.reserves.B;
      const captureMaterial = isBoardA
        ? currentPosition.captureMaterial.A
        : currentPosition.captureMaterial.B;
      const fen = isBoardA ? currentPosition.fenA : currentPosition.fenB;
      const promotedSquares = isBoardA
        ? currentPosition.promotedSquares.A
        : currentPosition.promotedSquares.B;
      const lastMove = isBoardA ? lastMoveHighlightsByBoard.A : lastMoveHighlightsByBoard.B;
      const clocks = isBoardA ? clockSnapshot?.A : clockSnapshot?.B;
      const sideToMove = isBoardA ? sideToMoveA : sideToMoveB;
      const bottomReserveColor: BughouseSide = isBoardA
        ? isBoardsFlipped
          ? "black"
          : "white"
        : isBoardsFlipped
          ? "white"
          : "black";

      return {
        topSide,
        bottomSide,
        flip,
        reserves,
        captureMaterial,
        fen,
        promotedSquares,
        lastMove,
        clocks,
        sideToMove,
        bottomReserveColor,
      };
    },
    [
      clockSnapshot,
      currentPosition.captureMaterial,
      currentPosition.fenA,
      currentPosition.fenB,
      currentPosition.promotedSquares.A,
      currentPosition.promotedSquares.B,
      currentPosition.reserves.A,
      currentPosition.reserves.B,
      isBoardsFlipped,
      lastMoveHighlightsByBoard.A,
      lastMoveHighlightsByBoard.B,
      sideToMoveA,
      sideToMoveB,
    ],
  );

  const renderReserveColumn = useCallback(
    (boardId: BughouseBoardId) => {
      const boardConfig = getBoardDisplayConfig(boardId);
      return (
        <div
          className="bh-reserve-column"
          data-role="reserve-column"
          data-board-id={boardId}
        >
          <PieceReserveVertical
            whiteReserves={boardConfig.reserves.white}
            blackReserves={boardConfig.reserves.black}
            bottomColor={boardConfig.bottomReserveColor}
            height={reserveHeight}
            density={isCompactLandscape ? "compact" : "default"}
            disabled={isLiveReplayPlaying}
            onPieceClick={(payload) => handleReservePieceClick(boardId, payload)}
            onPieceDragStart={(payload) => handleReservePieceDragStart(boardId, payload)}
            onPieceDragEnd={handleReservePieceDragEnd}
            selected={
              state.pendingDrop?.board === boardId
                ? { color: state.pendingDrop.side, piece: state.pendingDrop.piece }
                : null
            }
          />
        </div>
      );
    },
    [
      getBoardDisplayConfig,
      handleReservePieceClick,
      handleReservePieceDragEnd,
      handleReservePieceDragStart,
      isCompactLandscape,
      isLiveReplayPlaying,
      reserveHeight,
      state.pendingDrop,
    ],
  );

  const renderBoardColumn = useCallback(
    (boardId: BughouseBoardId, columnSide: "left" | "right") => {
      const boardConfig = getBoardDisplayConfig(boardId);
      const boardPlayers = getPlayersForBoard(players, boardId);
      const cornerSide = columnSide === "left" ? "left" : "right";
      const topCorner = `top-${cornerSide}` as const;
      const bottomCorner = `bottom-${cornerSide}` as const;

      return (
        <div
          className="bh-board-column"
          data-role="board-column"
          data-board-id={boardId}
        >
          {renderPlayerBar(
            boardPlayers[boardConfig.topSide],
            boardConfig.clocks?.[boardConfig.topSide],
            getTeamForBoardSide(boardId, boardConfig.topSide),
            {
              isToMove: boardConfig.sideToMove === boardConfig.topSide,
              clocksFrozen: areClocksFrozen,
              cornerMaterial: {
                value: boardConfig.captureMaterial[boardConfig.topSide],
                corner: topCorner,
              },
            },
          )}
          <ChessBoard
            fen={boardConfig.fen}
            boardName={boardId}
            size={boardSize}
            flip={boardConfig.flip}
            annotations={boardId === "A" ? boardAAnnotations : boardBAnnotations}
            onAnnotationsChange={
              boardId === "A"
                ? handleBoardAAnnotationsChange
                : handleBoardBAnnotationsChange
            }
            promotedSquares={boardConfig.promotedSquares}
            lastMoveFromSquare={boardConfig.lastMove?.from ?? null}
            lastMoveToSquare={boardConfig.lastMove?.to ?? null}
            dropCursorActive={Boolean(state.pendingDrop && state.pendingDrop.board === boardId)}
            dragSourceSquare={
              dragLegalMoveHighlight?.board === boardId &&
              dragLegalMoveHighlight.fenAtDragStart === boardConfig.fen
                ? dragLegalMoveHighlight.from
                : null
            }
            dragLegalTargets={
              dragLegalMoveHighlight?.board === boardId &&
              dragLegalMoveHighlight.fenAtDragStart === boardConfig.fen
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
          {renderPlayerBar(
            boardPlayers[boardConfig.bottomSide],
            boardConfig.clocks?.[boardConfig.bottomSide],
            getTeamForBoardSide(boardId, boardConfig.bottomSide),
            {
              isToMove: boardConfig.sideToMove === boardConfig.bottomSide,
              clocksFrozen: areClocksFrozen,
              cornerMaterial: {
                value: boardConfig.captureMaterial[boardConfig.bottomSide],
                corner: bottomCorner,
              },
            },
          )}
        </div>
      );
    },
    [
      areClocksFrozen,
      boardAAnnotations,
      boardBAnnotations,
      boardSize,
      getBoardDisplayConfig,
      getTeamForBoardSide,
      handleBoardAAnnotationsChange,
      handleBoardBAnnotationsChange,
      handleDragEnd,
      handleDragStart,
      handleAttemptMove,
      handleAttemptReserveDrop,
      handleSquareClick,
      isLiveReplayPlaying,
      players,
      renderPlayerBar,
      state.pendingDrop,
      dragLegalMoveHighlight,
    ],
  );

  return (
    <div
      ref={analysisContainerRef}
      className="bh-analysis scrollbar-thin"
      style={
        {
          /**
           * CSS var used to align the move list height with the board play area in desktop mode.
           * We use a variable (instead of inline `height`) so responsive classes can override
           * height in stacked/tablet mode.
           */
          "--bh-play-area-height": `${playAreaHeight}px`,
          "--bh-board-size": `${boardSize}px`,
        } as React.CSSProperties
      }
    >
      <div
        className="bh-workspace"
      >
        {/* Left Column: Boards + Controls */}
        <div
          ref={fullscreenPanelRef}
          data-testid="analysis-board-panel"
          data-fullscreen={isBoardsFullscreen ? "true" : "false"}
          className="bh-board-panel"
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
            className="bh-boards"
            data-testid="boards-container"
          >
            {renderReserveColumn(leftBoardId)}
            {renderBoardColumn(leftBoardId, "left")}
            {renderBoardColumn(rightBoardId, "right")}
            {renderReserveColumn(rightBoardId)}
          </div>

          {/* Board Controls */}
          <div
            ref={controlsContainerRef}
            data-testid="analysis-controls"
            className={[
              "bh-controls grid w-full max-w-full items-center px-1",
              "grid-cols-[auto_minmax(0,1.15fr)_auto_minmax(0,1fr)_auto]",
            ].join(" ")}
            style={{ maxWidth: Math.max(420, controlsWidth) }}
          >
            {/* Fullscreen + live replay controls: left side */}
            <div className="shrink-0 inline-flex items-center gap-1 sm:gap-2">
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
              {isDesktopFullscreenAvailable ? (
                <TooltipAnchor content={isBoardsFullscreen ? "Exit full screen" : "Full screen"}>
                  <button
                    onClick={() => void handleToggleFullscreen()}
                    className={[
                      controlButtonBaseClass,
                      isBoardsFullscreen
                        ? "border-mariner-400 bg-mariner-500/15 text-mariner-100"
                        : "",
                    ].join(" ")}
                    aria-label={isBoardsFullscreen ? "Exit full screen" : "Enter full screen"}
                    aria-pressed={isBoardsFullscreen}
                    data-testid="analysis-fullscreen-toggle"
                    type="button"
                  >
                    <Fullscreen aria-hidden className={layout.controlIconSizeClass} />
                  </button>
                </TooltipAnchor>
              ) : null}
            </div>

            {/* Shared description spacer to keep controls centered */}
            <div aria-hidden="true" />

            {/* Center navigation controls */}
            <div
              className={[
                "shrink-0 flex items-center justify-center",
                isCompactLandscape ? "gap-1 sm:gap-2" : "gap-2 sm:gap-3",
              ].join(" ")}
            >
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
              <div className="relative inline-flex items-center">
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
                {sharedGameDescriptionTooltip ? (
                  <TooltipAnchor
                    content={sharedGameDescriptionTooltip}
                    className="absolute left-full ml-3 top-1/2 -translate-y-1/2 inline-flex"
                  >
                    <span
                      className={[
                        "inline-flex items-center justify-center text-gray-400 hover:text-gray-200",
                        "cursor-help",
                        isCompactLandscape ? "h-6 w-6" : "h-7 w-7",
                      ].join(" ")}
                      aria-label="View shared game description"
                      role="img"
                      tabIndex={0}
                    >
                      <MessageSquareText
                        className={isCompactLandscape ? "h-3.5 w-3.5" : "h-4 w-4"}
                        aria-hidden="true"
                      />
                    </span>
                  </TooltipAnchor>
                ) : null}
              </div>
            </div>

            {/* Spacer to mirror description column width */}
            <div aria-hidden="true" />

            {/* Right side: share + flip boards */}
            <div className="shrink-0 inline-flex items-center gap-2 pl-2">
              <TooltipAnchor content={shareDisabledReason ?? "Share game"}>
                <button
                  onClick={onShareClick}
                  disabled={!canShare}
                  className={controlButtonBaseClass}
                  aria-label="Share game"
                  type="button"
                >
                  <Save aria-hidden className={layout.controlIconSizeClass} />
                </button>
              </TooltipAnchor>
              <TooltipAnchor content="Flip boards (f)">
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
        </div>

        {!isBoardsFullscreen ? (
          /* Right Column: move list. It is deliberately removed while the board panel owns the
             fullscreen viewport so the available space goes entirely to the two boards. */
          <div
            data-testid="analysis-move-list-panel"
            className="bh-move-panel"
          >
            <MoveListWithVariations
              tree={state.tree}
              cursorNodeId={state.cursorNodeId}
              selectedNodeId={state.selectedNodeId}
              players={players}
              isBoardOrderSwapped={isBoardOrderSwapped}
              onToggleBoardOrder={handleToggleBoardOrder}
              combinedMoves={combinedMovesForMoveTimes}
              combinedMoveDurations={combinedMoveDurationsForMoveTimes}
              footer={moveListFooter}
              disabled={isLiveReplayPlaying}
              onSelectNode={selectNode}
              onPromoteVariationOneLevel={promoteVariationOneLevel}
              onTruncateAfterNode={truncateAfterNode}
              onTruncateFromNodeInclusive={truncateFromNodeInclusive}
              onShareGameFromNode={handleShareGameFromNode}
              canShareGameFromNode={canShareGameFromNode}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default observer(BughouseAnalysis);
