/**
 * @module opening-explorer/api
 *
 * Browser HTTP client for the opening explorer.
 *
 * All traffic targets the same-origin Next.js proxy at `/api/opening-explorer`.
 * The proxy owns the real service origin, allowlist, bearer token, and timeout.
 * This client only understands the bounded, versioned JSON contract.
 *
 * In-flight requests with the same URL and AbortSignal are deduplicated so
 * overlapping neighborhood/prefetch calls share one network round-trip.
 */

import type {
  DatasetMetadata,
  ExplorerErrorCode,
  ExplorerFilter,
  GameExamplesResponse,
  NeighborhoodResponse,
} from "./types";

/**
 * Typed failure from the opening explorer client or proxy.
 *
 * Callers should branch on `code` rather than parsing free-form messages.
 */
export class OpeningExplorerApiError extends Error {
  /**
   * @param code - Stable client error taxonomy entry.
   * @param message - Human-readable detail suitable for UI copy or logs.
   * @param status - Optional HTTP status from the proxy/service response.
   */
  constructor(
    public readonly code: ExplorerErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

/**
 * Parameters for a budgeted neighborhood fetch.
 *
 * Defaults for depth/node/byte budgets are applied by the upstream service when
 * omitted; the client only overrides them for experiments or tests.
 */
export interface NeighborhoodRequest {
  /** Dataset version that must match the published artifact. */
  datasetVersion: string;
  /** Anchor node whose neighborhood should be returned. */
  nodeId: number;
  /** Rules-state occurrence within the placement node. */
  stateId: number;
  /** Prefetch depth target (never an unconditional radius). */
  targetForwardDepth?: number;
  /** Soft/hard node budget forwarded to the service. */
  maxNodes?: number;
  /** Soft/hard encoded-byte budget forwarded to the service. */
  maxEncodedBytes?: number;
  /** Optional White/Black seat filter. */
  filter?: ExplorerFilter;
  /** Optional abort signal for navigation generations and idle prefetch. */
  signal?: AbortSignal;
}

/**
 * Appends trimmed White/Black filter query parameters when present.
 *
 * @param query - Mutable search params for the outbound request.
 * @param filter - Optional seat filter; empty usernames are ignored.
 */
function addFilter(query: URLSearchParams, filter?: ExplorerFilter): void {
  const white = filter?.white?.trim();
  const black = filter?.black?.trim();

  if (white) query.set("white", white);
  if (black) query.set("black", black);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function corruptResponse(message: string): OpeningExplorerApiError {
  return new OpeningExplorerApiError("corrupt_response", message);
}

/**
 * Same-origin opening-explorer API with request deduplication and response checks.
 */
export class OpeningExplorerApi {
  /**
   * In-flight GET promises keyed by absolute request URL.
   *
   * Entries are removed when the promise settles so retries remain possible.
   */
  private readonly inFlight = new Map<string, {
    promise: Promise<unknown>;
    signal: AbortSignal | undefined;
  }>();

  /**
   * @param baseUrl - Same-origin proxy prefix; defaults to `/api/opening-explorer`.
   * @param fetcher - Injectable `fetch` for unit tests.
   */
  constructor(
    private readonly baseUrl = "/api/opening-explorer",
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  /**
   * Performs a JSON GET, deduplicating concurrent identical URLs/signals.
   *
   * Network failures become `service_unavailable`. Non-OK payloads map known
   * remote codes onto the client taxonomy; malformed JSON becomes
   * `corrupt_response`. AbortErrors are rethrown unchanged.
   *
   * @param url - Fully composed same-origin request URL.
   * @param signal - Optional abort signal shared with the in-flight map.
   */
  private async json<T>(url: string, signal?: AbortSignal): Promise<T> {
    const existing = this.inFlight.get(url);

    if (existing && existing.signal === signal) {
      return existing.promise as Promise<T>;
    }

    const request = (async () => {
      let response: Response;

      try {
        response = await this.fetcher.call(globalThis, url, {
          signal,
          headers: { accept: "application/json" },
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }

        if (process.env.NODE_ENV !== "production") {
          console.error("Opening explorer fetch failed", url, error);
        }

        throw new OpeningExplorerApiError(
          "service_unavailable",
          "The local opening service is unavailable.",
        );
      }

      const payload = await response.json().catch(() => null) as Record<string, unknown> | null;

      if (!response.ok) {
        const remoteCode = typeof payload?.code === "string" ? payload.code : "invalid_request";
        const code: ExplorerErrorCode = remoteCode === "stale_dataset_version"
          ? "stale_dataset_version"
          : remoteCode === "service_unavailable"
            ? "service_unavailable"
            : "invalid_request";

        throw new OpeningExplorerApiError(
          code,
          typeof payload?.detail === "string"
            ? payload.detail
            : `Opening service returned HTTP ${response.status}.`,
          response.status,
        );
      }

      if (!payload || typeof payload !== "object") {
        throw new OpeningExplorerApiError(
          "corrupt_response",
          "The opening service returned invalid JSON.",
        );
      }

      return payload as T;
    })();

    this.inFlight.set(url, { promise: request, signal });

    try {
      return await request;
    } finally {
      if (this.inFlight.get(url)?.promise === request) {
        this.inFlight.delete(url);
      }
    }
  }

  /**
   * Loads publication metadata for the currently served dataset.
   *
   * @param signal - Optional abort signal for the initial page load.
   */
  async metadata(signal?: AbortSignal): Promise<DatasetMetadata> {
    const response = await this.json<Record<string, unknown>>(
      `${this.baseUrl}/api/meta`,
      signal,
    );
    const coverage = response.coverage;
    const terminalPolicy = response.terminal_policy;

    if (
      response.format_version !== "packed-position-graph-v1"
      || typeof response.adapter_policy !== "string"
      || typeof response.dataset_version !== "string"
      || !isId(response.root_node_id)
      || !isId(response.root_state_id)
      || ![
        "strict-source-game-v1",
        "skip-unreplayable-source-game-v1",
      ].includes(String(response.replay_policy))
      || !isRecord(coverage)
      || !isId(coverage.accepted_games)
      || typeof coverage.source_fingerprint !== "string"
      || ![
        "full-replay-game-end-v1",
        "last-shared-placement-plus-one-or-game-end-v1",
      ].includes(String(terminalPolicy))
    ) {
      throw corruptResponse("The opening service metadata is not a position graph.");
    }

    return response as unknown as DatasetMetadata;
  }

  /**
   * Fetches a budgeted neighborhood and validates it matches the request.
   *
   * Mismatched dataset version, anchor id, or missing arrays/overlays are
   * treated as corruption rather than silently rendering inconsistent state.
   *
   * @param request - Anchor, version, budgets, filter, and optional abort signal.
   */
  async neighborhood(request: NeighborhoodRequest): Promise<NeighborhoodResponse> {
    const query = new URLSearchParams({ dataset_version: request.datasetVersion });
    query.set("state_id", String(request.stateId));

    if (request.targetForwardDepth !== undefined) {
      query.set("target_forward_depth", String(request.targetForwardDepth));
    }

    if (request.maxNodes !== undefined) {
      query.set("max_nodes", String(request.maxNodes));
    }

    if (request.maxEncodedBytes !== undefined) {
      query.set("max_encoded_bytes", String(request.maxEncodedBytes));
    }

    addFilter(query, request.filter);

    const response = await this.json<NeighborhoodResponse>(
      `${this.baseUrl}/api/nodes/${request.nodeId}/neighborhood?${query}`,
      request.signal,
    );
    const expectedWhite = request.filter?.white?.trim() || null;
    const expectedBlack = request.filter?.black?.trim() || null;
    const filterMatches = expectedWhite === null && expectedBlack === null
      ? response.filter === null
      : isRecord(response.filter)
        && response.filter.white_username === expectedWhite
        && response.filter.black_username === expectedBlack;

    if (
      response.dataset_version !== request.datasetVersion
      || response.anchor_node_id !== request.nodeId
      || response.anchor_state_id !== request.stateId
      || !filterMatches
      || !Array.isArray(response.nodes)
      || !Array.isArray(response.states)
      || !Array.isArray(response.edges)
      || !Array.isArray(response.frontiers)
      || !isRecord(response.node_overlays)
      || !isRecord(response.state_overlays)
      || !isRecord(response.edge_overlays)
      || !isRecord(response.instrumentation)
    ) {
      throw corruptResponse("The neighborhood response did not match the request.");
    }

    const nodes = new Map<number, NeighborhoodResponse["nodes"][number]>();
    const states = new Map<number, NeighborhoodResponse["states"][number]>();
    const edgeIds = new Set<number>();

    for (const node of response.nodes) {
      if (!isId(node?.id) || nodes.has(node.id) || typeof node.placement !== "string") {
        throw corruptResponse("The neighborhood contains an invalid node.");
      }
      nodes.set(node.id, node);
    }
    for (const state of response.states) {
      if (
        !isId(state?.id)
        || states.has(state.id)
        || !isId(state.node_id)
        || !nodes.has(state.node_id)
        || typeof state.position_fen !== "string"
      ) {
        throw corruptResponse("The neighborhood contains an invalid state.");
      }
      states.set(state.id, state);
    }
    if (
      !nodes.has(request.nodeId)
      || states.get(request.stateId)?.node_id !== request.nodeId
    ) {
      throw corruptResponse("The neighborhood omitted or mismatched its anchor.");
    }
    for (const edge of response.edges) {
      if (
        !isId(edge?.id)
        || edgeIds.has(edge.id)
        || !states.has(edge.parent_state_id)
        || states.get(edge.child_state_id)?.node_id !== edge.child_id
        || typeof edge.move_token !== "string"
        || typeof edge.move_label !== "string"
        || !response.edge_overlays[String(edge.id)]
      ) {
        throw corruptResponse("The neighborhood contains an invalid edge.");
      }
      edgeIds.add(edge.id);
    }
    for (const nodeId of nodes.keys()) {
      if (!response.node_overlays[String(nodeId)]) {
        throw corruptResponse("The neighborhood omitted a node overlay.");
      }
    }
    for (const stateId of states.keys()) {
      if (!response.state_overlays[String(stateId)]) {
        throw corruptResponse("The neighborhood omitted a state overlay.");
      }
    }
    for (const frontier of response.frontiers) {
      if (states.get(frontier?.state_id)?.node_id !== frontier?.node_id) {
        throw corruptResponse("The neighborhood contains an invalid frontier.");
      }
    }

    return response;
  }

  /**
   * Loads a capped set of example games for one traversed edge.
   *
   * @param datasetVersion - Active dataset version.
   * @param edgeId - Edge whose matching games should be returned.
   * @param filter - Seat filter to apply server-side.
   * @param limit - Maximum examples to request (default 6).
   * @param signal - Optional abort signal for leaf/detail loads.
   */
  async edgeGameExamples(
    datasetVersion: string,
    edgeId: number,
    filter: ExplorerFilter,
    limit = 6,
    signal?: AbortSignal,
  ): Promise<GameExamplesResponse> {
    const query = new URLSearchParams({
      dataset_version: datasetVersion,
      limit: String(limit),
    });

    addFilter(query, filter);

    const response = await this.json<GameExamplesResponse>(
      `${this.baseUrl}/api/edges/${edgeId}/games?${query}`,
      signal,
    );
    if (
      response.dataset_version !== datasetVersion
      || response.edge_id !== edgeId
      || !Array.isArray(response.games)
      || !Number.isSafeInteger(response.total_matching)
      || !Number.isSafeInteger(response.actual_ending_count)
    ) {
      throw corruptResponse("The edge game response did not match the request.");
    }
    return response;
  }

  /**
   * Prefix-searches indexed usernames without downloading the full corpus.
   *
   * @param datasetVersion - Active dataset version.
   * @param prefix - Username prefix typed by the user.
   * @param signal - Optional abort signal for typeahead cancellation.
   * @returns Matching usernames, or throws on version/shape corruption.
   */
  async searchPlayers(
    datasetVersion: string,
    prefix: string,
    signal?: AbortSignal,
  ): Promise<string[]> {
    const query = new URLSearchParams({
      dataset_version: datasetVersion,
      prefix,
      limit: "10",
    });

    const response = await this.json<{
      dataset_version: string;
      players: Array<{ username: string }>;
    }>(
      `${this.baseUrl}/api/players?${query}`,
      signal,
    );

    if (response.dataset_version !== datasetVersion || !Array.isArray(response.players)) {
      throw corruptResponse("The player response did not match the dataset.");
    }

    return response.players.map((player) => player.username);
  }
}
