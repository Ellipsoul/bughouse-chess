import type {
  DatasetMetadata,
  ExplorerErrorCode,
  ExplorerFilter,
  GameExamplesResponse,
  NeighborhoodResponse,
} from "./types";

export class OpeningExplorerApiError extends Error {
  constructor(public readonly code: ExplorerErrorCode, message: string, public readonly status?: number) {
    super(message);
  }
}

export interface NeighborhoodRequest {
  datasetVersion: string;
  nodeId: number;
  targetForwardDepth?: number;
  maxNodes?: number;
  maxEncodedBytes?: number;
  filter?: ExplorerFilter;
  signal?: AbortSignal;
}

function addFilter(query: URLSearchParams, filter?: ExplorerFilter): void {
  const white = filter?.white?.trim();
  const black = filter?.black?.trim();
  if (white) query.set("white", white);
  if (black) query.set("black", black);
}

export class OpeningExplorerApi {
  private readonly inFlight = new Map<string, {
    promise: Promise<unknown>;
    signal: AbortSignal | undefined;
  }>();

  constructor(
    private readonly baseUrl = "/api/opening-explorer",
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async json<T>(url: string, signal?: AbortSignal): Promise<T> {
    const existing = this.inFlight.get(url);
    if (existing && existing.signal === signal) return existing.promise as Promise<T>;
    const request = (async () => {
      let response: Response;
      try {
        response = await this.fetcher.call(globalThis, url, {
          signal,
          headers: { accept: "application/json" },
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        if (process.env.NODE_ENV !== "production") {
          console.error("Opening explorer fetch failed", url, error);
        }
        throw new OpeningExplorerApiError("service_unavailable", "The local opening service is unavailable.");
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
          typeof payload?.detail === "string" ? payload.detail : `Opening service returned HTTP ${response.status}.`,
          response.status,
        );
      }
      if (!payload || typeof payload !== "object") {
        throw new OpeningExplorerApiError("corrupt_response", "The opening service returned invalid JSON.");
      }
      return payload as T;
    })();
    this.inFlight.set(url, { promise: request, signal });
    try {
      return await request;
    } finally {
      if (this.inFlight.get(url)?.promise === request) this.inFlight.delete(url);
    }
  }

  metadata(signal?: AbortSignal): Promise<DatasetMetadata> {
    return this.json<DatasetMetadata>(`${this.baseUrl}/api/meta`, signal);
  }

  async neighborhood(request: NeighborhoodRequest): Promise<NeighborhoodResponse> {
    const query = new URLSearchParams({ dataset_version: request.datasetVersion });
    if (request.targetForwardDepth !== undefined) query.set("target_forward_depth", String(request.targetForwardDepth));
    if (request.maxNodes !== undefined) query.set("max_nodes", String(request.maxNodes));
    if (request.maxEncodedBytes !== undefined) query.set("max_encoded_bytes", String(request.maxEncodedBytes));
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
      throw new OpeningExplorerApiError("corrupt_response", "The neighborhood response did not match the request.");
    }
    return response;
  }

  gameExamples(
    datasetVersion: string,
    nodeId: number,
    filter: ExplorerFilter,
    limit = 6,
    signal?: AbortSignal,
  ): Promise<GameExamplesResponse> {
    const query = new URLSearchParams({ dataset_version: datasetVersion, limit: String(limit) });
    addFilter(query, filter);
    return this.json<GameExamplesResponse>(
      `${this.baseUrl}/api/nodes/${nodeId}/games?${query}`,
      signal,
    );
  }

  async searchPlayers(datasetVersion: string, prefix: string, signal?: AbortSignal): Promise<string[]> {
    const query = new URLSearchParams({ dataset_version: datasetVersion, prefix, limit: "10" });
    const response = await this.json<{ dataset_version: string; players: Array<{ username: string }> }>(
      `${this.baseUrl}/api/players?${query}`,
      signal,
    );
    if (response.dataset_version !== datasetVersion || !Array.isArray(response.players)) {
      throw new OpeningExplorerApiError("corrupt_response", "The player response did not match the dataset.");
    }
    return response.players.map((player) => player.username);
  }
}
