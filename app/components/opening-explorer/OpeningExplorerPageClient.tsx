"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Database, Loader2 } from "lucide-react";
import type { Square } from "chess.js";
import ChessBoard from "../board/ChessBoard";
import { OpeningExplorerApi, OpeningExplorerApiError } from "./api";
import { replayOpeningPrefix } from "./boardState";
import { OpeningExplorerCache } from "./cache";
import type {
  DatasetMetadata,
  ExplorerErrorCode,
  ExplorerFilter,
  GameExample,
  GameExamplesResponse,
  StructuralEdge,
} from "./types";

const EMPTY_FILTER: ExplorerFilter = { white: null, black: null };
const DRAW_RESULTS = new Set([
  "50move",
  "agreed",
  "insufficient",
  "repetition",
  "stalemate",
  "timevsinsufficient",
  "timevsinsufficientmaterial",
]);

interface ClientMetrics {
  foregroundRequests: number;
  prefetchRequests: number;
  responseBytes: number;
  frontierStalls: number;
  lastClickRenderMs: number;
}

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
  return { blackPercent, blackWins, drawPercent, draws, total, whitePercent, whiteWins };
}

function OutcomeBar({ results, support }: { results: Record<string, number>; support: number }) {
  const outcome = outcomeSummary(results, support);
  const label = `White wins ${outcome.whitePercent}%, draws ${outcome.drawPercent}%, Black wins ${outcome.blackPercent}%`;
  return (
    <span className="block w-44">
      <span role="img" aria-label={label} className="flex h-2 overflow-hidden rounded-full border border-slate-600 bg-slate-800">
        <span className="bg-white" style={{ width: `${(outcome.whiteWins / outcome.total) * 100}%` }} />
        <span className="bg-slate-400" style={{ width: `${(outcome.draws / outcome.total) * 100}%` }} />
        <span className="bg-slate-950" style={{ width: `${(outcome.blackWins / outcome.total) * 100}%` }} />
      </span>
      <span className="mt-1 flex justify-between text-[10px] text-slate-400" aria-hidden="true">
        <span>W {outcome.whiteWins}</span><span>D {outcome.draws}</span><span>B {outcome.blackWins}</span>
      </span>
    </span>
  );
}

function errorCode(error: unknown): ExplorerErrorCode {
  if (error instanceof OpeningExplorerApiError) return error.code;
  return "corrupt_response";
}

function errorCopy(code: ExplorerErrorCode): string {
  if (code === "service_unavailable") return "The opening read service is unavailable. Retry shortly.";
  if (code === "stale_dataset_version") return "The dataset changed. Reload to use the newly published version.";
  if (code === "corrupt_response") return "The opening artifact or response could not be read safely.";
  return "The opening request was rejected by its safety limits.";
}

function gameResultLabel(game: GameExample): string {
  if (game.white_result === "win") return "1–0";
  if (game.black_result === "win") return "0–1";
  if (
    (game.white_result !== null && DRAW_RESULTS.has(game.white_result))
    || (game.black_result !== null && DRAW_RESULTS.has(game.black_result))
  ) return "½–½";
  return "*";
}

export default function OpeningExplorerPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useMemo(() => new OpeningExplorerApi(), []);
  const cache = useMemo(() => new OpeningExplorerCache(5_000), []);
  const [metadata, setMetadata] = useState<DatasetMetadata | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(null);
  const [path, setPath] = useState<Array<{ move_token: string | null; node_id: number }>>([]);
  const [filter, setFilter] = useState<ExplorerFilter>(EMPTY_FILTER);
  const [draftWhite, setDraftWhite] = useState("");
  const [draftBlack, setDraftBlack] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [examples, setExamples] = useState<GameExamplesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<ExplorerErrorCode | null>(null);
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
  const generation = useRef(0);
  const navigationController = useRef<AbortController | null>(null);
  const idleController = useRef<AbortController | null>(null);
  const gameDetailsController = useRef<AbortController | null>(null);
  const attemptedIdleRefills = useRef(new Set<string>());
  const continuationButtons = useRef(new Map<number, HTMLButtonElement>());
  const automaticLeafRequest = useRef<string | null>(null);
  const boardArea = useRef<HTMLElement | null>(null);

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

  const mergeResponse = useCallback((
    response: Awaited<ReturnType<OpeningExplorerApi["neighborhood"]>>,
    requestKind: "foreground" | "prefetch",
  ) => {
    cache.merge(response);
    setRevision((value) => value + 1);
    setMetrics((value) => ({
      ...value,
      foregroundRequests: value.foregroundRequests + (requestKind === "foreground" ? 1 : 0),
      prefetchRequests: value.prefetchRequests + (requestKind === "prefetch" ? 1 : 0),
      responseBytes: value.responseBytes + response.instrumentation.encoded_bytes,
    }));
  }, [cache]);

  const pinCachedPathNeighborhoods = useCallback((version: string, pathNodeIds: readonly number[]) => {
    const pinned = new Set(pathNodeIds);
    for (const nodeId of pathNodeIds) {
      for (const edge of cache.getChildren(version, nodeId)) pinned.add(edge.child_id);
    }
    cache.pin(version, [...pinned]);
  }, [cache]);

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
      const response = await api.neighborhood({
        datasetVersion: dataset.dataset_version,
        nodeId,
        filter: nextFilter,
        signal: controller.signal,
      });
      if (requestGeneration !== generation.current) return;
      mergeResponse(response, "foreground");
      setCurrentNodeId(nodeId);
      if (updatePath) setPath(response.path);
      pinCachedPathNeighborhoods(
        dataset.dataset_version,
        response.path.map((entry) => entry.node_id),
      );
      setExamples(null);
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

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const dataset = await api.metadata(controller.signal);
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

  const prefixTokens = useMemo(
    () => path.map((entry) => entry.move_token).filter((token): token is string => token !== null),
    [path],
  );
  const position = useMemo(() => {
    try {
      return replayOpeningPrefix(prefixTokens);
    } catch {
      return null;
    }
  }, [prefixTokens]);
  const currentNode = metadata && currentNodeId !== null
    ? cache.getNode(metadata.dataset_version, currentNodeId)
    : undefined;
  const currentOverlay = metadata && currentNodeId !== null
    ? cache.getOverlay(metadata.dataset_version, currentNodeId, filter)
    : undefined;
  const children = useMemo(
    () => {
      void revision;
      return metadata && currentNodeId !== null
        ? cache.getChildren(metadata.dataset_version, currentNodeId)
        : [];
    },
    [cache, currentNodeId, metadata, revision],
  );
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
  const locksUniqueLine = currentOverlay?.support === 1;
  const uniqueContinuation = locksUniqueLine && continuations.length === 1
    ? continuations[0]
    : null;
  const shouldLoadUniqueGame = locksUniqueLine && (
    uniqueContinuation !== null
    || currentOverlay?.actual_ending_count === 0
  );

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

  useEffect(() => {
    if (selectedContinuationId === null) return;
    continuationButtons.current.get(selectedContinuationId)?.scrollIntoView?.({ block: "nearest" });
  }, [selectedContinuationId]);

  useEffect(() => {
    if (!metadata || currentNodeId === null || !cache.isFrontier(metadata.dataset_version, currentNodeId)) return;
    const filterIdentity = `${filter.white?.trim().toLowerCase() ?? ""}\0${filter.black?.trim().toLowerCase() ?? ""}`;
    const refillIdentity = `${metadata.dataset_version}:${currentNodeId}:${filterIdentity}`;
    if (attemptedIdleRefills.current.has(refillIdentity)) return;
    if (attemptedIdleRefills.current.size >= 5_000) attemptedIdleRefills.current.clear();
    attemptedIdleRefills.current.add(refillIdentity);
    const idle = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(callback, 120));
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
        if (metadata.dataset_version === response.dataset_version) mergeResponse(response, "prefetch");
      } catch {
        // Idle prefetch is opportunistic; foreground navigation owns visible errors.
      }
    });
    return () => cancelIdle(handle);
  }, [api, cache, currentNodeId, filter, mergeResponse, metadata, revision]);

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
    setExamples(null);
    pinCachedPathNeighborhoods(
      metadata.dataset_version,
      [...path.map((entry) => entry.node_id), edge.child_id],
    );
    setRevision((value) => value + 1);
    setMetrics((value) => ({ ...value, lastClickRenderMs: performance.now() - clickedAt }));
    router.push(`/opening-explorer?node=${edge.child_id}&dataset=${encodeURIComponent(metadata.dataset_version)}`);
    if (cached.child_count > 0 && cache.getChildren(metadata.dataset_version, edge.child_id).length === 0) {
      void loadNeighborhood(metadata, edge.child_id, filter, false);
    }
  }, [cache, filter, loadNeighborhood, metadata, path, pinCachedPathNeighborhoods, router]);

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
    setExamples(null);
    pinCachedPathNeighborhoods(
      metadata.dataset_version,
      nextPath.map((entry) => entry.node_id),
    );
    setRevision((value) => value + 1);
    router.push(`/opening-explorer?node=${nodeId}&dataset=${encodeURIComponent(metadata.dataset_version)}`);
    const cachedNode = cache.getNode(metadata.dataset_version, nodeId);
    const cachedOverlay = cache.getOverlay(metadata.dataset_version, nodeId, filter);
    if (cachedNode && (
      !cachedOverlay
      || cache.getChildren(metadata.dataset_version, nodeId).length < cachedNode.child_count
    )) {
      void loadNeighborhood(metadata, nodeId, filter, false);
    }
  }, [cache, filter, loadNeighborhood, metadata, path, pinCachedPathNeighborhoods, router]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;

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
        if (!selected) return;
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

  const applyFilter = useCallback(() => {
    if (!metadata || currentNodeId === null) return;
    const nextFilter = { white: draftWhite.trim() || null, black: draftBlack.trim() || null };
    setFilter(nextFilter);
    void loadNeighborhood(metadata, currentNodeId, nextFilter, false);
  }, [currentNodeId, draftBlack, draftWhite, loadNeighborhood, metadata]);

  const findPlayers = useCallback(async (value: string) => {
    if (!metadata || value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      setSuggestions(await api.searchPlayers(metadata.dataset_version, value.trim()));
    } catch {
      setSuggestions([]);
    }
  }, [api, metadata]);

  useEffect(() => {
    gameDetailsController.current?.abort();
    setExamples(null);
    if (!shouldLoadUniqueGame || !metadata || currentNodeId === null) {
      automaticLeafRequest.current = null;
      return;
    }
    const identity = `${metadata.dataset_version}:${currentNodeId}:${filter.white ?? ""}:${filter.black ?? ""}`;
    if (automaticLeafRequest.current === identity) return;
    automaticLeafRequest.current = identity;
    const controller = new AbortController();
    gameDetailsController.current = controller;
    void api.gameExamples(metadata.dataset_version, currentNodeId, filter, 1, controller.signal)
      .then((response) => {
        if (automaticLeafRequest.current === identity) setExamples(response);
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (automaticLeafRequest.current === identity) setError(errorCode(caught));
      });
    return () => controller.abort();
  }, [api, currentNodeId, filter, metadata, shouldLoadUniqueGame, uniqueContinuation]);

  if (loading) {
    return <div className="flex h-full items-center justify-center bg-slate-950 text-slate-100"><Loader2 className="mr-3 h-5 w-5 animate-spin" />Loading opening dataset…</div>;
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
    return <div className="flex h-full items-center justify-center bg-slate-950 text-red-200">The selected prefix could not be reconstructed safely.</div>;
  }

  const cacheMetrics = cache.metrics();
  const uniqueGame = examples?.games[0] ?? null;
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
          <p className="mt-1 text-xs text-slate-400">Dataset {metadata.dataset_version.slice(0, 10)} · {metadata.coverage.accepted_games.toLocaleString()} representative games · {metadata.adapter_policy}</p>
        </div>
        {refreshing ? <span className="flex items-center text-xs text-slate-400"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Refilling cache</span> : null}
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
            <button
              type="button"
              aria-label="Go to starting position"
              aria-current={playedMoves.length === 0 ? "true" : undefined}
              onClick={() => navigateToBreadcrumb(0)}
              className={`mt-3 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${playedMoves.length === 0 ? "border-cyan-400/70 bg-slate-800 text-cyan-100" : "border-slate-700 bg-slate-950 text-slate-400 hover:border-cyan-500/60 hover:bg-slate-800 hover:text-white"}`}
            >
              Starting position
            </button>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
              {moveRows.length === 0 ? <p className="rounded-lg border border-dashed border-slate-800 px-3 py-5 text-center text-sm text-slate-500">No moves played yet</p> : <ol className="space-y-1.5">
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
            <h2 className="text-sm font-semibold text-slate-200">Player filters</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-400">White<input value={draftWhite} onChange={(event) => { setDraftWhite(event.target.value); void findPlayers(event.target.value); }} list="opening-player-suggestions" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white" /></label>
              <label className="text-xs text-slate-400">Black<input value={draftBlack} onChange={(event) => { setDraftBlack(event.target.value); void findPlayers(event.target.value); }} list="opening-player-suggestions" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white" /></label>
              <datalist id="opening-player-suggestions">{suggestions.map((username) => <option key={username} value={username} />)}</datalist>
            </div>
            <div className="mt-3 flex gap-2"><button type="button" onClick={applyFilter} className="rounded bg-cyan-600 px-3 py-2 text-sm font-medium hover:bg-cyan-500">Apply filter</button><button type="button" onClick={() => { setDraftWhite(""); setDraftBlack(""); setFilter(EMPTY_FILTER); void loadNeighborhood(metadata, currentNodeId, EMPTY_FILTER, false); }} className="rounded border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">Clear</button></div>
          </section>

          {error ? <div role="alert" className="shrink-0 rounded-xl border border-amber-400/30 bg-amber-950/20 p-4 text-sm text-amber-100">{errorCopy(error)}</div> : null}

          <section aria-label="Opening Tree" className="flex min-h-88 flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/70 p-4 lg:min-h-0">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Opening Tree</h2><span className="text-xs text-slate-400">{currentOverlay?.support ?? 0} {currentOverlay?.support === 1 ? "game" : "games"}</span></div>
            {currentOverlay?.support === 0 ? <p className="mt-3 rounded bg-slate-950 p-3 text-sm text-slate-400">No games match this exact White/Black filter at the current prefix.</p> : null}
            <div aria-label="Candidate move choices" className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
              {uniqueContinuation ? (uniqueGame?.url ? <a
                href={uniqueGame.url}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={`${uniqueContinuation.label}, ${uniqueGame.white_username}, ${gameResultLabel(uniqueGame)}, ${uniqueGame.black_username}; open game on Chess.com`}
                className="group flex w-full items-center gap-3 rounded-lg border border-cyan-400 bg-slate-800 px-3 py-3 text-left ring-1 ring-cyan-400/30 transition-colors hover:bg-slate-700"
              >
                <span className="shrink-0 font-mono text-sm font-medium text-white">{uniqueContinuation.label}</span>
                <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm">
                  <span className="truncate text-right text-cyan-100">{uniqueGame.white_username}</span>
                  <strong className="whitespace-nowrap text-cyan-300">{gameResultLabel(uniqueGame)}</strong>
                  <span className="truncate text-slate-200">{uniqueGame.black_username}</span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-xs text-slate-400 transition-colors group-hover:text-cyan-200">↗</span>
              </a> : <div
                aria-label={`${uniqueContinuation.label}, loading source game`}
                className="flex w-full items-center gap-3 rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-slate-400"
              >
                <span className="font-mono text-sm text-slate-200">{uniqueContinuation.label}</span>
                <span className="flex-1 text-center text-xs">Loading source game…</span>
              </div>) : continuations.map(({ edge, label, overlay }) => {
                const selected = edge.child_id === selectedContinuationId;
                return <button key={edge.child_id} ref={(element) => { if (element) continuationButtons.current.set(edge.child_id, element); else continuationButtons.current.delete(edge.child_id); }} type="button" aria-current={selected ? "true" : undefined} aria-label={`${label}, ${overlay.support} ${overlay.support === 1 ? "game" : "games"}`} onFocus={() => setSelectedContinuationId(edge.child_id)} onMouseEnter={() => setSelectedContinuationId(edge.child_id)} onClick={() => navigate(edge)} className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${selected ? "border-cyan-400 bg-slate-800 ring-1 ring-cyan-400/30" : "border-slate-700 bg-slate-950 hover:border-cyan-500/60 hover:bg-slate-800"}`}><span className="min-w-0 flex-1 font-mono text-sm text-white">{label}</span><span className="text-right text-xs text-slate-400"><strong className="text-slate-200">{overlay.support}</strong></span><OutcomeBar results={overlay.results} support={overlay.support} /></button>;
              })}
              {!uniqueContinuation && locksUniqueLine && currentOverlay?.actual_ending_count === 0 ? (uniqueGame?.url ? <a
                href={uniqueGame.url}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={`Source game, ${uniqueGame.white_username}, ${gameResultLabel(uniqueGame)}, ${uniqueGame.black_username}; open game on Chess.com`}
                className="group flex w-full items-center gap-3 rounded-lg border border-cyan-400/70 bg-slate-800 px-3 py-3 text-left transition-colors hover:border-cyan-300 hover:bg-slate-700"
              >
                <span className="shrink-0 font-mono text-sm font-medium text-cyan-100">Game</span>
                <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm">
                  <span className="truncate text-right text-cyan-100">{uniqueGame.white_username}</span>
                  <strong className="whitespace-nowrap text-cyan-300">{gameResultLabel(uniqueGame)}</strong>
                  <span className="truncate text-slate-200">{uniqueGame.black_username}</span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-xs text-slate-400 transition-colors group-hover:text-cyan-200">↗</span>
              </a> : <div aria-label="Loading source game" className="flex w-full items-center gap-3 rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-slate-400"><span className="font-mono text-sm text-slate-200">Game</span><span className="flex-1 text-center text-xs">Loading source game…</span></div>) : null}
              {currentOverlay && currentOverlay.actual_ending_count > 0 ? <div aria-label={`${currentOverlay.actual_ending_count} ${currentOverlay.actual_ending_count === 1 ? "game ends" : "games end"} at this position`} className="flex w-full items-center gap-3 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-slate-400"><span className="min-w-0 flex-1 font-mono text-sm text-slate-300">-</span><span className="text-xs"><strong className="text-slate-200">{currentOverlay.actual_ending_count}</strong></span><span className="w-44 text-right text-[10px] uppercase tracking-wide text-slate-500">ended here</span></div> : null}
              {continuations.length === 0 && !locksUniqueLine && currentOverlay?.actual_ending_count === 0 && currentOverlay.support !== 0 ? <p className="text-sm text-slate-400">No continuations from this position.</p> : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
