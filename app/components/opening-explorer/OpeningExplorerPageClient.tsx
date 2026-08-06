"use client";

/**
 * @module opening-explorer/OpeningExplorerPageClient
 *
 * Interactive one-board opening explorer UI.
 *
 * Ownership boundary: this surface does not share the two-board viewer’s
 * analysis tree, clocks, reserves, or URL state. It navigates an exact
 * move-prefix trie published by the opening read service, through the
 * same-origin proxy and a bounded in-memory LRU cache.
 *
 * Interaction model:
 * - Up/Down select a continuation; Right plays it; Left returns along the path
 * - Cached forward steps update local path/state without a network round-trip
 * - Missing children count as frontier stalls and trigger a foreground refill
 * - Idle prefetch refills truncated frontiers opportunistically
 * - Support-one leaves open in the Relay analysis board; keyboard nav stops there
 * - Actual endings render as an unclickable `-` row
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Check, ChevronsUpDown, Database, Loader2, Search } from "lucide-react";
import type { Square } from "chess.js";
import { buildBughouseAnalysisUrl } from "@/app/utils/discovery/bughouseAnalysisUrl";
import ChessBoard from "../board/ChessBoard";
import { OpeningExplorerApi, OpeningExplorerApiError } from "./api";
import { replayOpeningPrefix } from "./boardState";
import { OpeningExplorerCache } from "./cache";
import type {
  DatasetMetadata,
  ExplorerErrorCode,
  ExplorerFilter,
  GameExample,
  StructuralEdge,
} from "./types";

/** Unfiltered seat filter used on first load and after Clear. */
const EMPTY_FILTER: ExplorerFilter = { white: null, black: null };

/** Seat occupied by the single preparation target. */
type PlayerSeat = "white" | "black";

/** State of the latest corpus-backed player lookup. */
type PlayerLookup = {
  query: string;
  status: "idle" | "loading" | "ready" | "error";
};

/** Bounded source-game detail loaded for one support-one child. */
type SourceGameEntry = {
  game: GameExample | null;
  status: "loading" | "loaded" | "error";
};

/**
 * Chess.com-style result strings treated as draws for the outcome bar.
 *
 * Black wins are derived as residual support so the three segments always sum
 * to the filtered game count even when the histogram omits explicit losses.
 */
const DRAW_RESULTS = new Set([
  "50move",
  "agreed",
  "insufficient",
  "repetition",
  "stalemate",
  "timevsinsufficient",
  "timevsinsufficientmaterial",
]);

/**
 * Client-side instrumentation counters for the prototype details panel.
 */
interface ClientMetrics {
  foregroundRequests: number;
  prefetchRequests: number;
  responseBytes: number;
  frontierStalls: number;
  lastClickRenderMs: number;
}

/**
 * Collapses a result histogram into White/draw/Black counts and percentages.
 *
 * @param results - Overlay result histogram from the service.
 * @param support - Distinct games remaining under the active filter.
 */
function outcomeSummary(results: Record<string, number>, support: number) {
  const whiteWins = results.win ?? 0;
  const draws = Object.entries(results).reduce(
    (total, [result, count]) => total + (DRAW_RESULTS.has(result) ? count : 0),
    0,
  );
  const blackWins = Math.max(0, support - whiteWins - draws);
  const total = Math.max(1, whiteWins + draws + blackWins);
  const whitePercent = Math.round((whiteWins / total) * 100);
  const drawPercent = Math.round((draws / total) * 100);
  const blackPercent = Math.max(0, 100 - whitePercent - drawPercent);

  return {
    blackPercent,
    blackWins,
    drawPercent,
    draws,
    total,
    whitePercent,
    whiteWins,
  };
}

/**
 * Compact White/draw/Black bar shown beside each continuation row.
 *
 * @param props.results - Result histogram for the child overlay.
 * @param props.support - Filtered support used as the residual denominator.
 */
function OutcomeBar({
  results,
  support,
}: {
  results: Record<string, number>;
  support: number;
}) {
  const outcome = outcomeSummary(results, support);
  const label =
    `White wins ${outcome.whitePercent}%, draws ${outcome.drawPercent}%, Black wins ${outcome.blackPercent}%`;

  return (
    <span className="block w-44">
      <span
        role="img"
        aria-label={label}
        className="flex h-2 overflow-hidden rounded-full border border-slate-600 bg-slate-800"
      >
        <span className="bg-white" style={{ width: `${(outcome.whiteWins / outcome.total) * 100}%` }} />
        <span className="bg-slate-400" style={{ width: `${(outcome.draws / outcome.total) * 100}%` }} />
        <span className="bg-slate-950" style={{ width: `${(outcome.blackWins / outcome.total) * 100}%` }} />
      </span>
      <span className="mt-1 flex justify-between text-[10px] text-slate-400" aria-hidden="true">
        <span>W {outcome.whiteWins}</span>
        <span>D {outcome.draws}</span>
        <span>B {outcome.blackWins}</span>
      </span>
    </span>
  );
}

/**
 * Maps unknown failures onto the client error taxonomy.
 *
 * @param error - Thrown value from an API call or unexpected failure.
 */
function errorCode(error: unknown): ExplorerErrorCode {
  if (error instanceof OpeningExplorerApiError) return error.code;
  return "corrupt_response";
}

/**
 * User-facing copy for a typed explorer error.
 *
 * @param code - Stable client error code.
 */
function errorCopy(code: ExplorerErrorCode): string {
  if (code === "service_unavailable") {
    return "The opening read service is unavailable. Retry shortly.";
  }

  if (code === "stale_dataset_version") {
    return "The dataset changed. Reload to use the newly published version.";
  }

  if (code === "corrupt_response") {
    return "The opening artifact or response could not be read safely.";
  }

  return "The opening request was rejected by its safety limits.";
}

/** Publishes one low-cardinality diagnostic mark without affecting page behavior. */
function markOpeningExplorerPhase(name: string, detail?: Record<string, number>): void {
  if (typeof performance === "undefined" || typeof performance.mark !== "function") return;

  try {
    performance.mark(
      `opening-explorer:${name}`,
      detail === undefined ? undefined : { detail },
    );
  } catch {
    // Performance diagnostics must never make the explorer unavailable.
  }
}

/**
 * Formats a game example as a short score string for source-link rows.
 *
 * @param game - Bounded game detail from the examples endpoint.
 */
function gameResultLabel(game: GameExample): string {
  if (game.white_result === "win") return "1–0";
  if (game.black_result === "win") return "0–1";

  if (
    (game.white_result !== null && DRAW_RESULTS.has(game.white_result))
    || (game.black_result !== null && DRAW_RESULTS.has(game.black_result))
  ) {
    return "½–½";
  }

  return "*";
}

/** One lifted support-one move or terminal source-game row. */
function SourceGameRow({
  entry,
  label,
  onSelect,
  register,
  selected = false,
}: {
  entry: SourceGameEntry | undefined;
  label: string;
  onSelect?: () => void;
  register?: (element: HTMLAnchorElement | null) => void;
  selected?: boolean;
}) {
  const game = entry?.game;

  if (!game?.url) {
    return (
      <div
        aria-label={`${label}, ${entry?.status === "error" ? "source game unavailable" : "loading source game"}`}
        className={`flex w-full items-center gap-3 rounded-lg border bg-slate-950 px-3 py-3 ${entry?.status === "error" ? "border-red-500/40 text-red-300" : "border-slate-700 text-slate-400"}`}
      >
        <span className="font-mono text-sm text-slate-200">{label}</span>
        <span className="flex-1 text-center text-xs">{entry?.status === "error" ? "Source game could not be loaded." : "Loading source game…"}</span>
      </div>
    );
  }

  const accessiblePrefix = label === "Game" ? "Source game" : label;

  return (
    <a
      ref={register}
      href={buildBughouseAnalysisUrl(game.url)}
      target="_blank"
      rel="noreferrer noopener"
      aria-current={selected ? "true" : undefined}
      aria-label={`${accessiblePrefix}, ${game.white_username}, ${gameResultLabel(game)}, ${game.black_username}; open in Bughouse analysis`}
      onFocus={onSelect}
      onMouseEnter={onSelect}
      className={`group flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors hover:bg-slate-700 ${selected ? "border-cyan-400 bg-slate-800 ring-1 ring-cyan-400/30" : "border-cyan-400/70 bg-slate-800"}`}
    >
      <span className="shrink-0 font-mono text-sm font-medium text-white">{label}</span>
      <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm">
        <span className="truncate text-right text-cyan-100">{game.white_username}</span>
        <strong className="whitespace-nowrap text-cyan-300">{gameResultLabel(game)}</strong>
        <span className="truncate text-slate-200">{game.black_username}</span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-xs text-slate-400 transition-colors group-hover:text-cyan-200">↗</span>
    </a>
  );
}

/**
 * Client page for `/opening-explorer`.
 *
 * Owns dataset bootstrap, path navigation, filter application, keyboard
 * selection, idle frontier refill, and support-one game-detail loading.
 */
export default function OpeningExplorerPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useMemo(() => new OpeningExplorerApi(), []);
  const cache = useMemo(() => new OpeningExplorerCache(5_000), []);

  const [metadata, setMetadata] = useState<DatasetMetadata | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(null);
  const [path, setPath] = useState<Array<{ move_token: string | null; node_id: number }>>([]);
  const [filter, setFilter] = useState<ExplorerFilter>(EMPTY_FILTER);
  const [draftPlayer, setDraftPlayer] = useState("");
  const [playerQuery, setPlayerQuery] = useState("");
  const [filterSeat, setFilterSeat] = useState<PlayerSeat>("white");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [playerLookup, setPlayerLookup] = useState<PlayerLookup>({ query: "", status: "idle" });
  const [sourceGames, setSourceGames] = useState<Record<number, SourceGameEntry>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<ExplorerErrorCode | null>(null);
  /** Bumped after cache merges so memoized child/continuation views recompute. */
  const [revision, setRevision] = useState(0);
  const [boardSize, setBoardSize] = useState(420);
  const [selectedContinuationId, setSelectedContinuationId] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<ClientMetrics>({
    foregroundRequests: 0,
    prefetchRequests: 0,
    responseBytes: 0,
    frontierStalls: 0,
    lastClickRenderMs: 0,
  });

  /**
   * Monotonic navigation generation. Stale async responses whose generation no
   * longer matches are ignored so rapid clicks cannot overwrite newer state.
   */
  const generation = useRef(0);
  const navigationController = useRef<AbortController | null>(null);
  const idleController = useRef<AbortController | null>(null);
  const gameDetailsController = useRef<AbortController | null>(null);
  const playerSearchGeneration = useRef(0);
  const firstUsefulPaintScheduled = useRef(false);
  /** Identities of idle frontier refills already attempted this session. */
  const attemptedIdleRefills = useRef(new Set<string>());
  const continuationButtons = useRef(new Map<number, HTMLElement>());
  const boardArea = useRef<HTMLElement | null>(null);
  const playerPicker = useRef<HTMLDivElement | null>(null);

  const playerIsKnown = draftPlayer.trim().length > 0;

  useEffect(() => {
    markOpeningExplorerPhase("hydrated");
  }, []);

  /** Closes the player picker without changing its selected value. */
  useEffect(() => {
    if (!suggestionsOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !playerPicker.current?.contains(event.target)) {
        setSuggestionsOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [suggestionsOpen]);

  /**
   * Keeps the board square within the available layout slot on resize.
   *
   * Desktop widths reserve space for the move list / controls columns; the
   * board is clamped between 260px and 680px.
   */
  useEffect(() => {
    const resize = () => {
      const rect = boardArea.current?.getBoundingClientRect();
      const reservedWidth = window.innerWidth >= 1280 ? 780 : window.innerWidth >= 1024 ? 430 : 32;
      const availableWidth = rect && rect.width > 0
        ? rect.width - 24
        : window.innerWidth - reservedWidth;
      const boardTop = rect && rect.top > 0 ? rect.top : 140;
      const availableHeight = window.innerHeight - boardTop - 92;

      setBoardSize(Math.max(260, Math.min(680, availableWidth, availableHeight)));
    };

    resize();

    const boardElement = boardArea.current;
    const observer = typeof ResizeObserver === "undefined" || !boardElement
      ? null
      : new ResizeObserver(resize);

    if (observer && boardElement) observer.observe(boardElement);
    window.addEventListener("resize", resize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  /**
   * Merges a neighborhood into the LRU cache and updates instrumentation.
   *
   * @param response - Validated neighborhood payload.
   * @param requestKind - Whether the request was user-visible or idle prefetch.
   */
  const mergeResponse = useCallback((
    response: Awaited<ReturnType<OpeningExplorerApi["neighborhood"]>>,
    requestKind: "foreground" | "prefetch",
  ) => {
    const mergeStarted = performance.now();
    cache.merge(response);
    markOpeningExplorerPhase("cache-merge", {
      duration_ms: performance.now() - mergeStarted,
    });
    setRevision((value) => value + 1);
    setMetrics((value) => ({
      ...value,
      foregroundRequests: value.foregroundRequests + (requestKind === "foreground" ? 1 : 0),
      prefetchRequests: value.prefetchRequests + (requestKind === "prefetch" ? 1 : 0),
      responseBytes: value.responseBytes + response.instrumentation.encoded_bytes,
    }));
  }, [cache]);

  /**
   * Pins the active path and its immediate children against LRU eviction.
   *
   * Immediate children are included so forward candidates stay resident while
   * the user inspects the current position.
   *
   * @param version - Active dataset version.
   * @param pathNodeIds - Node ids from root through the current prefix.
   */
  const pinCachedPathNeighborhoods = useCallback((
    version: string,
    pathNodeIds: readonly number[],
  ) => {
    const pinned = new Set(pathNodeIds);

    for (const nodeId of pathNodeIds) {
      for (const edge of cache.getChildren(version, nodeId)) {
        pinned.add(edge.child_id);
      }
    }

    cache.pin(version, [...pinned]);
  }, [cache]);

  /**
   * Foreground neighborhood fetch with generation-based stale-response discard.
   *
   * @param dataset - Active publication metadata.
   * @param nodeId - Anchor to fetch.
   * @param nextFilter - Seat filter for overlays.
   * @param updatePath - When true, replace breadcrumbs from the response path.
   */
  const loadNeighborhood = useCallback(async (
    dataset: DatasetMetadata,
    nodeId: number,
    nextFilter: ExplorerFilter,
    updatePath: boolean,
  ) => {
    const requestGeneration = ++generation.current;

    navigationController.current?.abort();

    const controller = new AbortController();

    navigationController.current = controller;
    setRefreshing(true);
    setError(null);

    try {
      markOpeningExplorerPhase("neighborhood-request-start");
      const response = await api.neighborhood({
        datasetVersion: dataset.dataset_version,
        nodeId,
        filter: nextFilter,
        signal: controller.signal,
      });
      markOpeningExplorerPhase("neighborhood-response");

      if (requestGeneration !== generation.current) return;

      mergeResponse(response, "foreground");
      setCurrentNodeId(nodeId);

      if (updatePath) setPath(response.path);

      pinCachedPathNeighborhoods(
        dataset.dataset_version,
        response.path.map((entry) => entry.node_id),
      );
      setSourceGames({});
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      if (requestGeneration === generation.current) setError(errorCode(caught));
    } finally {
      if (requestGeneration === generation.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [api, mergeResponse, pinCachedPathNeighborhoods]);

  /**
   * Bootstraps metadata and the initial (possibly deep-linked) neighborhood.
   *
   * Deep-link `?node=` is read only here; subsequent navigation updates the URL
   * locally without re-running this effect.
   */
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    (async () => {
      setLoading(true);

      try {
        markOpeningExplorerPhase("metadata-request-start");
        const dataset = await api.metadata(controller.signal);
        markOpeningExplorerPhase("metadata-response");

        if (!mounted) return;

        setMetadata(dataset);
        cache.activateDataset(dataset.dataset_version);
        attemptedIdleRefills.current.clear();

        const requestedNode = Number(searchParams.get("node"));
        const nodeId = Number.isSafeInteger(requestedNode) && requestedNode >= 0
          ? requestedNode
          : dataset.root_node_id;

        await loadNeighborhood(dataset, nodeId, EMPTY_FILTER, true);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;

        if (mounted) {
          setError(errorCode(caught));
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
      controller.abort();
      navigationController.current?.abort();
      idleController.current?.abort();
      gameDetailsController.current?.abort();
    };
    // The first request owns deep-link discovery; later navigation is handled locally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, cache, loadNeighborhood]);

  /** TCN tokens along the current path, excluding the root's null token. */
  const prefixTokens = useMemo(
    () => path.map((entry) => entry.move_token).filter((token): token is string => token !== null),
    [path],
  );

  /** Display FEN/moves for the current prefix, or `null` if TCN replay fails. */
  const position = useMemo(() => {
    const replayStarted = performance.now();

    try {
      const replayed = replayOpeningPrefix(prefixTokens);

      markOpeningExplorerPhase("replay", {
        duration_ms: performance.now() - replayStarted,
      });
      return replayed;
    } catch {
      markOpeningExplorerPhase("replay", {
        duration_ms: performance.now() - replayStarted,
      });
      return null;
    }
  }, [prefixTokens]);

  const currentNode = metadata && currentNodeId !== null
    ? cache.getNode(metadata.dataset_version, currentNodeId)
    : undefined;
  const currentOverlay = metadata && currentNodeId !== null
    ? cache.getOverlay(metadata.dataset_version, currentNodeId, filter)
    : undefined;

  useEffect(() => {
    if (
      loading
      || !metadata
      || currentNodeId === null
      || !currentNode
      || !currentOverlay
      || !position
      || firstUsefulPaintScheduled.current
    ) return;

    firstUsefulPaintScheduled.current = true;
    let recorded = false;
    const handle = window.requestAnimationFrame(() => {
      recorded = true;
      markOpeningExplorerPhase("first-useful-paint");
    });

    return () => {
      window.cancelAnimationFrame(handle);
      if (!recorded) firstUsefulPaintScheduled.current = false;
    };
  }, [currentNode, currentNodeId, currentOverlay, loading, metadata, position]);

  /** Immediate child edges still resident in cache for the current node. */
  const children = useMemo(
    () => {
      void revision;

      return metadata && currentNodeId !== null
        ? cache.getChildren(metadata.dataset_version, currentNodeId)
        : [];
    },
    [cache, currentNodeId, metadata, revision],
  );

  /**
   * Filtered, labeled, support-sorted continuations offered in the Opening Tree.
   *
   * Zero-support children are omitted. Labels prefer TCN replay; corrupt tokens
   * fall back to a placeholder without blocking the rest of the list.
   */
  const continuations = useMemo(() => {
    if (!metadata) return [];

    return children.flatMap((edge) => {
      const overlay = cache.getOverlay(metadata.dataset_version, edge.child_id, filter);

      if (!overlay?.support) return [];

      let label = "Unavailable move";

      try {
        label = replayOpeningPrefix([...prefixTokens, edge.move_token]).moves.at(-1)?.label ?? label;
      } catch {
        // The exact token remains internal if a corrupt move cannot be decoded for display.
      }

      return [{ edge, label, overlay }];
    }).sort((left, right) => (
      right.overlay.support - left.overlay.support
      || left.label.localeCompare(right.label)
      || left.edge.child_id - right.edge.child_id
    ));
  }, [cache, children, filter, metadata, prefixTokens]);

  /** True when the active filter collapses the prefix to a single game. */
  const locksUniqueLine = currentOverlay?.support === 1;

  /** Support-one child nodes whose source links should be lifted into this list. */
  const sourceGameNodeIds = useMemo(() => {
    const nodeIds = continuations
      .filter(({ overlay }) => overlay.support === 1)
      .map(({ edge }) => edge.child_id);

    if (
      nodeIds.length === 0
      && locksUniqueLine
      && currentNodeId !== null
      && currentOverlay?.actual_ending_count === 0
    ) {
      nodeIds.push(currentNodeId);
    }

    return nodeIds;
  }, [continuations, currentNodeId, currentOverlay?.actual_ending_count, locksUniqueLine]);

  /**
   * Keeps keyboard/mouse selection aligned with the visible continuation list.
   *
   * Support-one leaves clear selection because the row becomes a source link
   * rather than a navigable continuation.
   */
  useEffect(() => {
    if (locksUniqueLine) {
      setSelectedContinuationId(null);
      return;
    }

    setSelectedContinuationId((selected) => (
      continuations.some(({ edge }) => edge.child_id === selected)
        ? selected
        : continuations[0]?.edge.child_id ?? null
    ));
  }, [continuations, locksUniqueLine]);

  /** Scrolls the selected continuation into view inside the Opening Tree list. */
  useEffect(() => {
    if (selectedContinuationId === null) return;
    continuationButtons.current.get(selectedContinuationId)?.scrollIntoView?.({ block: "nearest" });
  }, [selectedContinuationId]);

  /**
   * Opportunistically refills a frontier node while the browser is idle.
   *
   * Failures stay silent: only foreground navigation surfaces errors to the UI.
   */
  useEffect(() => {
    if (!metadata || currentNodeId === null || !cache.isFrontier(metadata.dataset_version, currentNodeId)) {
      return;
    }

    const filterIdentity =
      `${filter.white?.trim().toLowerCase() ?? ""}\0${filter.black?.trim().toLowerCase() ?? ""}`;
    const refillIdentity = `${metadata.dataset_version}:${currentNodeId}:${filterIdentity}`;

    if (attemptedIdleRefills.current.has(refillIdentity)) return;

    if (attemptedIdleRefills.current.size >= 5_000) {
      attemptedIdleRefills.current.clear();
    }

    attemptedIdleRefills.current.add(refillIdentity);

    const idle = window.requestIdleCallback
      ?? ((callback: IdleRequestCallback) => window.setTimeout(callback, 120));
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;

    const handle = idle(async () => {
      idleController.current?.abort();

      const controller = new AbortController();

      idleController.current = controller;

      try {
        const response = await api.neighborhood({
          datasetVersion: metadata.dataset_version,
          nodeId: currentNodeId,
          filter,
          signal: controller.signal,
        });

        if (metadata.dataset_version === response.dataset_version) {
          mergeResponse(response, "prefetch");
        }
      } catch {
        // Idle prefetch is opportunistic; foreground navigation owns visible errors.
      }
    });

    return () => cancelIdle(handle);
  }, [api, cache, currentNodeId, filter, mergeResponse, metadata, revision]);

  /**
   * Advances one ply along `edge`, preferring a cache-local update.
   *
   * Missing children count as frontier stalls and fall back to a foreground
   * neighborhood fetch. When the child is cached but its own children are not,
   * a background refill preserves the path update latency.
   *
   * @param edge - Structural edge departing the current node.
   */
  const navigate = useCallback((edge: StructuralEdge) => {
    if (!metadata) return;

    const clickedAt = performance.now();
    const cached = cache.getNode(metadata.dataset_version, edge.child_id);

    if (!cached) {
      setMetrics((value) => ({ ...value, frontierStalls: value.frontierStalls + 1 }));
      void loadNeighborhood(metadata, edge.child_id, filter, true);
      return;
    }

    generation.current += 1;
    navigationController.current?.abort();
    gameDetailsController.current?.abort();
    setCurrentNodeId(edge.child_id);
    setPath((previous) => [...previous, { move_token: edge.move_token, node_id: edge.child_id }]);
    setSourceGames({});
    pinCachedPathNeighborhoods(
      metadata.dataset_version,
      [...path.map((entry) => entry.node_id), edge.child_id],
    );
    setRevision((value) => value + 1);
    setMetrics((value) => ({ ...value, lastClickRenderMs: performance.now() - clickedAt }));
    router.push(
      `/opening-explorer?node=${edge.child_id}&dataset=${encodeURIComponent(metadata.dataset_version)}`,
    );

    if (
      cached.child_count > 0
      && cache.getChildren(metadata.dataset_version, edge.child_id).length === 0
    ) {
      void loadNeighborhood(metadata, edge.child_id, filter, false);
    }
  }, [cache, filter, loadNeighborhood, metadata, path, pinCachedPathNeighborhoods, router]);

  /**
   * Returns to a breadcrumb index along the cached path.
   *
   * Restores selection to the child that was left so Up/Down feel continuous
   * after Left. Refills when the overlay or child list is incomplete.
   *
   * @param index - Path index to become the new current position (0 = root).
   */
  const navigateToBreadcrumb = useCallback((index: number) => {
    if (!metadata) return;

    generation.current += 1;
    navigationController.current?.abort();
    gameDetailsController.current?.abort();

    const returnChildId = path[index + 1]?.node_id ?? null;
    const nextPath = path.slice(0, index + 1);
    const nodeId = nextPath.at(-1)?.node_id ?? metadata.root_node_id;

    setPath(nextPath);
    setCurrentNodeId(nodeId);
    setSelectedContinuationId(returnChildId);
    setSourceGames({});
    pinCachedPathNeighborhoods(
      metadata.dataset_version,
      nextPath.map((entry) => entry.node_id),
    );
    setRevision((value) => value + 1);
    router.push(
      `/opening-explorer?node=${nodeId}&dataset=${encodeURIComponent(metadata.dataset_version)}`,
    );

    const cachedNode = cache.getNode(metadata.dataset_version, nodeId);
    const cachedOverlay = cache.getOverlay(metadata.dataset_version, nodeId, filter);

    if (cachedNode && (
      !cachedOverlay
      || cache.getChildren(metadata.dataset_version, nodeId).length < cachedNode.child_count
    )) {
      void loadNeighborhood(metadata, nodeId, filter, false);
    }
  }, [cache, filter, loadNeighborhood, metadata, path, pinCachedPathNeighborhoods, router]);

  /**
   * Keyboard navigation for the Opening Tree.
   *
   * Ignores events originating from form fields. Arrow Right is intentionally
   * disabled on support-one leaves so users stop at the Chess.com source boundary.
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;

      if (target instanceof Element && target.closest("input, textarea, select, [role='combobox'], [contenteditable='true']")) {
        return;
      }

      if (!locksUniqueLine && (event.key === "ArrowDown" || event.key === "ArrowUp") && continuations.length > 0) {
        event.preventDefault();

        const currentIndex = continuations.findIndex(({ edge }) => edge.child_id === selectedContinuationId);
        const nextIndex = event.key === "ArrowDown"
          ? Math.min(currentIndex < 0 ? 0 : currentIndex + 1, continuations.length - 1)
          : Math.max(currentIndex < 0 ? 0 : currentIndex - 1, 0);

        setSelectedContinuationId(continuations[nextIndex].edge.child_id);
        return;
      }

      if (event.key === "ArrowRight") {
        if (locksUniqueLine) return;

        const selected = continuations.find(({ edge }) => edge.child_id === selectedContinuationId);

        if (!selected || selected.overlay.support === 1) return;

        event.preventDefault();
        navigate(selected.edge);
        return;
      }

      if (event.key === "ArrowLeft" && path.length > 1) {
        event.preventDefault();
        navigateToBreadcrumb(path.length - 2);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [continuations, locksUniqueLine, navigate, navigateToBreadcrumb, path.length, selectedContinuationId]);

  /**
   * Applies the selected player in exactly one seat and refetches overlays.
   */
  const applyPlayerFilter = useCallback((seat: PlayerSeat) => {
    if (!metadata || currentNodeId === null || !playerIsKnown) return;

    const player = draftPlayer.trim() || null;
    const nextFilter = seat === "white"
      ? { white: player, black: null }
      : { white: null, black: player };

    setFilter(nextFilter);
    void loadNeighborhood(metadata, currentNodeId, nextFilter, false);
  }, [currentNodeId, draftPlayer, loadNeighborhood, metadata, playerIsKnown]);

  /** Applies the selected player using the currently selected seat. */
  const applyFilter = useCallback(() => {
    applyPlayerFilter(filterSeat);
  }, [applyPlayerFilter, filterSeat]);

  /** Changes seat and immediately reapplies an active player filter. */
  const changeFilterSeat = useCallback((seat: PlayerSeat) => {
    setFilterSeat(seat);
    if (seat !== filterSeat && (filter.white !== null || filter.black !== null)) {
      applyPlayerFilter(seat);
    }
  }, [applyPlayerFilter, filter, filterSeat]);

  /**
   * Typeahead player search with stale-response protection.
   *
   * @param value - Current draft username input.
   */
  const findPlayers = useCallback(async (value: string) => {
    const query = value.trim().toLocaleLowerCase();
    const requestGeneration = playerSearchGeneration.current + 1;

    playerSearchGeneration.current = requestGeneration;

    if (!metadata || !query) {
      setSuggestions([]);
      setPlayerLookup({ query: "", status: "idle" });
      return;
    }

    setPlayerLookup({ query, status: "loading" });

    try {
      const players = await api.searchPlayers(metadata.dataset_version, query);

      if (playerSearchGeneration.current !== requestGeneration) return;

      setSuggestions(players);
      setPlayerLookup({ query, status: "ready" });
    } catch {
      if (playerSearchGeneration.current !== requestGeneration) return;

      setSuggestions([]);
      setPlayerLookup({ query, status: "error" });
    }
  }, [api, metadata]);

  /** Auto-loads bounded game details for every visible support-one child. */
  useEffect(() => {
    gameDetailsController.current?.abort();
    setSourceGames(Object.fromEntries(
      sourceGameNodeIds.map((nodeId) => [nodeId, { game: null, status: "loading" }]),
    ));

    if (sourceGameNodeIds.length === 0 || !metadata) {
      return;
    }

    const controller = new AbortController();
    let disposed = false;

    gameDetailsController.current = controller;

    for (const nodeId of sourceGameNodeIds) {
      void api.gameExamples(metadata.dataset_version, nodeId, filter, 1, controller.signal)
        .then((response) => {
          if (disposed) return;
          const game = response.games[0] ?? null;
          setSourceGames((current) => ({
            ...current,
            [nodeId]: { game, status: game?.url ? "loaded" : "error" },
          }));
        })
        .catch((caught) => {
          if (disposed || (caught instanceof Error && caught.name === "AbortError")) return;
          setSourceGames((current) => ({
            ...current,
            [nodeId]: { game: null, status: "error" },
          }));
        });
    }

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [api, filter, metadata, sourceGameNodeIds]);

  if (loading) {
    return (
      <div
        aria-live="polite"
        className="flex h-full flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center text-slate-100"
        role="status"
      >
        <div className="flex items-center">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          <span>Loading opening dataset…</span>
        </div>
        <p className="max-w-sm text-sm text-slate-400">
          Cold starts can take up to 20 seconds. Please be patient.
        </p>
      </div>
    );
  }

  if (error && !metadata) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950 p-8 text-slate-100">
        <div className="max-w-lg rounded-xl border border-amber-400/30 bg-amber-950/20 p-6">
          <AlertTriangle className="mb-3 h-7 w-7 text-amber-300" />
          <h1 className="text-xl font-semibold">Opening explorer unavailable</h1>
          <p className="mt-2 text-sm text-slate-300">{errorCopy(error)}</p>
        </div>
      </div>
    );
  }

  if (!metadata || currentNodeId === null || !currentNode || !position) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950 text-red-200">
        The selected prefix could not be reconstructed safely.
      </div>
    );
  }

  const cacheMetrics = cache.metrics();
  const playedMoves = position.moves.map((move, index) => ({
    label: move.label,
    nodeId: path[index + 1].node_id,
    pathIndex: index + 1,
  }));
  const moveRows = Array.from(
    { length: Math.ceil(playedMoves.length / 2) },
    (_, index) => ({
      black: playedMoves[index * 2 + 1] ?? null,
      moveNumber: index + 1,
      white: playedMoves[index * 2],
    }),
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950 text-slate-100">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <div className="flex items-center gap-2"><Database className="h-4 w-4 text-cyan-300" /><h1 className="font-semibold">Opening explorer</h1><span className="rounded bg-cyan-950 px-2 py-0.5 text-[11px] text-cyan-200">HOSTED EXPERIMENT</span></div>
          <p className="mt-1 text-xs text-slate-400">Dataset {metadata.dataset_version.slice(0, 10)} · {metadata.coverage.accepted_games.toLocaleString()} accepted games · {metadata.adapter_policy}</p>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto p-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,390px)] lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_minmax(240px,300px)_minmax(330px,390px)] xl:grid-rows-[minmax(0,1fr)]">
        <section
          ref={boardArea}
          aria-label="Opening board"
          className="flex min-h-0 min-w-0 flex-col items-center justify-center lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:overflow-hidden xl:row-span-1"
        >
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl">
            <ChessBoard
              boardName="A"
              fen={position.fen}
              size={boardSize}
              interactionsEnabled={false}
              lastMoveFromSquare={(position.lastMove?.from ?? null) as Square | null}
              lastMoveToSquare={(position.lastMove?.to ?? null) as Square | null}
            />
          </div>
        </section>

        <aside aria-label="Played moves" className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-1 xl:row-start-1 xl:min-h-0 xl:overflow-hidden">
          <section aria-label="Move list" className="flex min-h-48 flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/70 p-4 xl:min-h-0">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Move list</h2>
              <span className="text-xs text-slate-500">{playedMoves.length} {playedMoves.length === 1 ? "ply" : "plies"}</span>
            </div>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
              {moveRows.length === 0 ? <p className="flex h-full min-h-24 items-center justify-center text-center text-sm text-slate-600">No moves yet</p> : <ol className="space-y-1.5">
                {moveRows.map((row) => <li key={row.moveNumber} className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1.5">
                  <span className="text-right font-mono text-xs text-slate-500">{row.moveNumber}.</span>
                  {[row.white, row.black].map((move, sideIndex) => move ? <button
                    key={move.nodeId}
                    type="button"
                    aria-label={`Go to position after ${move.label}`}
                    aria-current={move.pathIndex === path.length - 1 ? "true" : undefined}
                    onClick={() => navigateToBreadcrumb(move.pathIndex)}
                    className={`min-w-0 rounded-md border px-2 py-1.5 text-left font-mono text-sm transition-colors ${move.pathIndex === path.length - 1 ? "border-cyan-400 bg-slate-800 text-white ring-1 ring-cyan-400/20" : "border-slate-800 bg-slate-950 text-slate-300 hover:border-cyan-500/60 hover:bg-slate-800 hover:text-white"}`}
                  >
                    <span className="block truncate">{move.label}</span>
                  </button> : <span key={`empty-${sideIndex}`} />)}
                </li>)}
              </ol>}
            </div>
          </section>

          <details className="shrink-0 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-400">
            <summary className="cursor-pointer text-slate-300">Prototype instrumentation</summary>
            <dl className="mt-3 grid grid-cols-2 gap-2">
              <dt>Foreground neighborhood requests</dt>
              <dd>{metrics.foregroundRequests}</dd>
              <dt>Prefetch neighborhood requests</dt>
              <dd>{metrics.prefetchRequests}</dd>
              <dt>Response bytes</dt>
              <dd>{metrics.responseBytes.toLocaleString()}</dd>
              <dt>Cache hits / misses</dt>
              <dd>{cacheMetrics.cacheHits} / {cacheMetrics.cacheMisses}</dd>
              <dt>Returned / used nodes</dt>
              <dd>{cacheMetrics.returnedNodes} / {cacheMetrics.usedNodes}</dd>
              <dt>Evicted nodes</dt>
              <dd>{cacheMetrics.evictedNodes}</dd>
              <dt>Frontier stalls</dt>
              <dd>{metrics.frontierStalls}</dd>
              <dt>Last click render</dt>
              <dd>{metrics.lastClickRenderMs.toFixed(2)} ms</dd>
              <dt>Format</dt>
              <dd>{metadata.format_version}</dd>
              <dt>Terminal policy</dt>
              <dd>{metadata.terminal_policy}</dd>
            </dl>
          </details>
        </aside>

        <aside aria-label="Explorer controls" className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-2 lg:min-h-0 lg:overflow-hidden xl:col-start-3 xl:row-start-1">
          <section className="shrink-0 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="text-sm font-semibold text-slate-200">Player filter</h2>
            <div className="mt-3 flex items-end gap-2">
              <div ref={playerPicker} className="relative min-w-0 flex-1 text-xs text-slate-400">
                <span>Player</span>
                <button
                  type="button"
                  role="combobox"
                  aria-label="Player"
                  aria-controls="opening-player-suggestions"
                  aria-expanded={suggestionsOpen}
                  onClick={() => {
                    setSuggestionsOpen((open) => !open);
                    setPlayerQuery("");
                    setSuggestions([]);
                    setPlayerLookup({ query: "", status: "idle" });
                  }}
                  className="mt-1 flex w-full items-center justify-between gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm text-white outline-none transition-colors hover:border-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                >
                  <span className={draftPlayer ? "truncate" : "truncate text-slate-500"}>{draftPlayer || "Search for a player"}</span>
                  <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
                </button>
                {suggestionsOpen ? <div className="absolute top-full z-20 mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-1 shadow-2xl">
                  <label className="relative block">
                    <span className="sr-only">Search players</span>
                    <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      autoFocus
                      type="search"
                      role="searchbox"
                      aria-label="Search players"
                      value={playerQuery}
                      onChange={(event) => { setPlayerQuery(event.target.value); void findPlayers(event.target.value); }}
                      onKeyDown={(event) => { if (event.key === "Escape") setSuggestionsOpen(false); }}
                      className="w-full rounded-md border border-slate-800 bg-slate-900 py-2 pl-8 pr-2 text-sm text-white outline-none focus:border-cyan-400"
                    />
                  </label>
                  <div id="opening-player-suggestions" role="listbox" aria-label="Player suggestions" className="mt-1 max-h-52 overflow-y-auto">
                    {playerLookup.status === "idle" ? <p className="px-2 py-3 text-center text-xs text-slate-500">Type to search players.</p> : null}
                    {playerLookup.status === "loading" ? <p className="flex items-center justify-center gap-2 px-2 py-3 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" />Searching...</p> : null}
                    {playerLookup.status === "ready" && suggestions.length === 0 ? <p className="px-2 py-3 text-center text-xs text-slate-500">No players found.</p> : null}
                    {playerLookup.status === "error" ? <p className="px-2 py-3 text-center text-xs text-amber-300">Player search is temporarily unavailable.</p> : null}
                    {suggestions.map((username) => <button
                      key={username}
                      type="button"
                      role="option"
                      aria-selected={draftPlayer.trim().toLowerCase() === username.toLowerCase()}
                      onClick={() => {
                        setDraftPlayer(username);
                        setPlayerQuery("");
                        setPlayerLookup({ query: username.toLocaleLowerCase(), status: "ready" });
                        setSuggestionsOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-slate-200 hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:outline-none"
                    ><Check aria-hidden="true" className={`h-4 w-4 ${draftPlayer.trim().toLowerCase() === username.toLowerCase() ? "opacity-100" : "opacity-0"}`} /><span className="truncate">{username}</span></button>)}
                  </div>
                </div> : null}
              </div>
              <button type="button" disabled={!playerIsKnown} onClick={applyFilter} className="shrink-0 rounded bg-cyan-600 px-3 py-2 text-sm font-medium transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">Apply filter</button>
              <button type="button" onClick={() => { playerSearchGeneration.current += 1; setDraftPlayer(""); setPlayerQuery(""); setSuggestions([]); setSuggestionsOpen(false); setPlayerLookup({ query: "", status: "idle" }); setFilter(EMPTY_FILTER); void loadNeighborhood(metadata, currentNodeId, EMPTY_FILTER, false); }} className="shrink-0 rounded border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">Clear</button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Player seat">
              {(["white", "black"] as const).map((seat) => <button
                key={seat}
                type="button"
                aria-pressed={filterSeat === seat}
                onClick={() => changeFilterSeat(seat)}
                className={`rounded border px-3 py-2 text-sm font-medium transition-colors ${filterSeat === seat ? "border-cyan-400 bg-cyan-950/70 text-cyan-100 ring-1 ring-cyan-400/20" : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500 hover:text-slate-200"}`}
              >{seat === "white" ? "White" : "Black"}</button>)}
            </div>
          </section>

          {error ? <div role="alert" className="shrink-0 rounded-xl border border-amber-400/30 bg-amber-950/20 p-4 text-sm text-amber-100">{errorCopy(error)}</div> : null}

          <section aria-label="Opening Tree" className="flex min-h-88 flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/70 p-4 lg:min-h-0">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Opening Tree</h2>{refreshing ? null : <span className="text-xs text-slate-400">{currentOverlay?.support ?? 0} {currentOverlay?.support === 1 ? "game" : "games"}</span>}</div>
            {!refreshing && currentOverlay?.support === 0 ? <p className="mt-3 rounded bg-slate-950 p-3 text-sm text-slate-400">No games match this exact White/Black filter at the current prefix.</p> : null}
            <div aria-label="Candidate move choices" className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
              {refreshing ? <div role="status" aria-live="polite" className="flex h-full min-h-40 items-center justify-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /><span>Loading...</span></div> : <>{continuations.map(({ edge, label, overlay }) => {
                const selected = edge.child_id === selectedContinuationId;
                const source = sourceGames[edge.child_id];

                if (overlay.support === 1) {
                  return <SourceGameRow
                    key={edge.child_id}
                    entry={source}
                    label={label}
                    onSelect={() => setSelectedContinuationId(edge.child_id)}
                    register={(element) => { if (element) continuationButtons.current.set(edge.child_id, element); else continuationButtons.current.delete(edge.child_id); }}
                    selected={selected}
                  />;
                }

                return <button key={edge.child_id} ref={(element) => { if (element) continuationButtons.current.set(edge.child_id, element); else continuationButtons.current.delete(edge.child_id); }} type="button" aria-current={selected ? "true" : undefined} aria-label={`${label}, ${overlay.support} games`} onFocus={() => setSelectedContinuationId(edge.child_id)} onMouseEnter={() => setSelectedContinuationId(edge.child_id)} onClick={() => navigate(edge)} className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${selected ? "border-cyan-400 bg-slate-800 ring-1 ring-cyan-400/30" : "border-slate-700 bg-slate-950 hover:border-cyan-500/60 hover:bg-slate-800"}`}><span className="min-w-0 flex-1 font-mono text-sm text-white">{label}</span><span className="text-right text-xs text-slate-400"><strong className="text-slate-200">{overlay.support}</strong></span><OutcomeBar results={overlay.results} support={overlay.support} /></button>;
              })}
              {continuations.length === 0 && locksUniqueLine && currentOverlay?.actual_ending_count === 0 ? <SourceGameRow entry={sourceGames[currentNodeId]} label="Game" /> : null}
              {currentOverlay && currentOverlay.actual_ending_count > 0 ? <div aria-label={`${currentOverlay.actual_ending_count} ${currentOverlay.actual_ending_count === 1 ? "game ends" : "games end"} at this position`} className="flex w-full items-center gap-3 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-slate-400"><span className="min-w-0 flex-1 font-mono text-sm text-slate-300">-</span><span className="text-xs"><strong className="text-slate-200">{currentOverlay.actual_ending_count}</strong></span><span className="w-44 text-right text-[10px] uppercase tracking-wide text-slate-500">ended here</span></div> : null}
              {continuations.length === 0 && !locksUniqueLine && currentOverlay?.actual_ending_count === 0 && currentOverlay.support !== 0 ? <p className="text-sm text-slate-400">No continuations from this position.</p> : null}</>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
