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
  metadata(signal?: AbortSignal): Promise<DatasetMetadata> {
    return this.json<DatasetMetadata>(`${this.baseUrl}/api/meta`, signal);
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

    if (
      response.dataset_version !== request.datasetVersion
      || response.anchor_node_id !== request.nodeId
      || !Array.isArray(response.nodes)
      || !Array.isArray(response.edges)
      || !response.overlays
    ) {
      throw new OpeningExplorerApiError(
        "corrupt_response",
        "The neighborhood response did not match the request.",
      );
    }

    return response;
  }

  /**
   * Loads a capped set of example games for a node under an optional filter.
   *
   * @param datasetVersion - Active dataset version.
   * @param nodeId - Node whose matching games should be returned.
   * @param filter - Seat filter to apply server-side.
   * @param limit - Maximum examples to request (default 6).
   * @param signal - Optional abort signal for leaf/detail loads.
   */
  gameExamples(
    datasetVersion: string,
    nodeId: number,
    filter: ExplorerFilter,
    limit = 6,
    signal?: AbortSignal,
  ): Promise<GameExamplesResponse> {
    const query = new URLSearchParams({
      dataset_version: datasetVersion,
      limit: String(limit),
    });

    addFilter(query, filter);

    return this.json<GameExamplesResponse>(
      `${this.baseUrl}/api/nodes/${nodeId}/games?${query}`,
      signal,
    );
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
      throw new OpeningExplorerApiError(
        "corrupt_response",
        "The player response did not match the dataset.",
      );
    }

    return response.players.map((player) => player.username);
  }
}
