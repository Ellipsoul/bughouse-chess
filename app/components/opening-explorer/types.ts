/**
 * @module opening-explorer/types
 *
 * Shared TypeScript contracts for the opening-explorer client.
 *
 * These shapes mirror the bounded JSON returned by the memory-mapped opening
 * read service (via the same-origin Next.js proxy). The browser never receives
 * the packed artifact, SQLite, or raw crawler payloads — only versioned
 * neighborhoods, overlays, and capped game examples.
 *
 * Node identity is the exact move-prefix path from the start position.
 * Transpositions are intentionally not merged. Structural records are
 * cacheable independently of filter overlays.
 */

/**
 * Dataset publication metadata returned by `GET /api/meta`.
 *
 * Clients treat `dataset_version` as a hard cache key: a new publication must
 * clear local structural and overlay caches rather than mixing versions.
 */
export interface DatasetMetadata {
  /** Adapter policy id that selected which games entered the index. */
  adapter_policy: string;
  /** High-level coverage stats for the published artifact. */
  coverage: { accepted_games: number; source_fingerprint: string };
  /** Immutable publication id used for cache keys and stale-version checks. */
  dataset_version: string;
  /** Packed artifact format version (for example `packed-prefix-interval-v2`). */
  format_version: string;
  /** Trie root node id for the empty move prefix. */
  root_node_id: number;
  /** Policy that decides when prefixes collapse to a sole game. */
  terminal_policy: string;
}

/**
 * Optional White/Black username filter applied to neighborhood and game queries.
 *
 * Empty/`null` means "no constraint on that seat". Normalization for cache keys
 * happens in the client cache layer, not here.
 */
export interface ExplorerFilter {
  white: string | null;
  black: string | null;
}

/**
 * Immutable structural trie node returned inside a neighborhood response.
 *
 * Prefix-interval fields (`interval_start` / `interval_end`) describe the
 * contiguous game-ordinal range covered by this exact move prefix.
 */
export interface StructuralNode {
  /** Number of immediate child edges in the global trie. */
  child_count: number;
  /** Dense node id within the published artifact. */
  id: number;
  /** Exclusive end of the packed game-ordinal interval. */
  interval_end: number;
  /** Inclusive start of the packed game-ordinal interval. */
  interval_start: number;
  /** Incoming move token from the parent, or `null` at the root. */
  move_token: string | null;
  /** Parent node id, or `null` at the root. */
  parent_id: number | null;
  /** Ply depth of this prefix (root is 0). */
  ply: number;
}

/**
 * Directed edge from a parent prefix to a child continuation.
 */
export interface StructuralEdge {
  /** Child node reached by playing `move_token`. */
  child_id: number;
  /** Encoded TCN token for the single ply along this edge. */
  move_token: string;
  /** Parent node the edge departs from. */
  parent_id: number;
}

/**
 * Filter-dependent aggregates for a structural node.
 *
 * Overlays are keyed separately from structures so unfiltered structural
 * navigation can reuse cached geometry when only the filter changes.
 */
export interface NodeOverlay {
  /** Games that actually terminate at this exact prefix. */
  actual_ending_count: number;
  /** Result histogram keyed by Chess.com-style result strings. */
  results: Record<string, number>;
  /** Sole matching game ordinal when support collapses to one, else `null`. */
  sole_game_ordinal: number | null;
  /** Distinct accepted games remaining under the active filter. */
  support: number;
}

/**
 * Bounded neighborhood payload for one anchor node.
 *
 * Always includes the anchor and every immediate child when budgets allow,
 * plus a deeper forward subset under hard node/byte caps. Truncated deeper
 * boundaries appear in `frontiers`.
 */
export interface NeighborhoodResponse {
  /** Node the neighborhood was requested for. */
  anchor_node_id: number;
  /** Dataset version that produced this payload; must match the request. */
  dataset_version: string;
  /** Flat edge records covering the returned neighborhood. */
  edges: StructuralEdge[];
  /** Normalized filter identity echoed by the service, or `null` if unfiltered. */
  filter: { white_username: string | null; black_username: string | null } | null;
  /** Truncated expansion boundaries that may need a later refill. */
  frontiers: Array<{ has_more: boolean; node_id: number; reason: "budget" | "target_depth" }>;
  /** Server-side timing and size counters for prototype instrumentation. */
  instrumentation: {
    budget_exception: boolean;
    elapsed_microseconds: number;
    encoded_bytes: number;
    returned_edges: number;
    returned_nodes: number;
    visited_nodes: number;
  };
  /** Flat structural nodes keyed by id after client merge. */
  nodes: StructuralNode[];
  /** Filter overlays keyed by stringified node id. */
  overlays: Record<string, NodeOverlay>;
  /** Ancestor path from root to the anchor, including move tokens. */
  path: Array<{ move_token: string | null; node_id: number }>;
  /** Prefetch depth target used for this response (not an unconditional radius). */
  target_forward_depth: number;
}

/**
 * One capped example game attached to a node or terminal leaf.
 */
export interface GameExample {
  /** Whether this game actually ends at the requested prefix. */
  actual_ending: boolean;
  /** Dense ordinal inside the packed artifact. */
  ordinal: number;
  /** Stable board UUID from the crawler corpus. */
  uuid: string;
  /** Public Chess.com URL when available. */
  url: string | null;
  white_username: string;
  black_username: string;
  white_rating: number | null;
  black_rating: number | null;
  white_result: string | null;
  black_result: string | null;
  /** Source class such as `public` or `callback`. */
  source: string;
  /** Policy/provenance flags retained for disclosure. */
  provenance_flags: string[];
}

/**
 * Bounded game-detail response for a single node.
 */
export interface GameExamplesResponse {
  actual_ending_count: number;
  dataset_version: string;
  games: GameExample[];
  /** Server-enforced example cap for this response. */
  limit: number;
  node_id: number;
  /** Total matching games before the response was capped. */
  total_matching: number;
}

/**
 * Client-facing error taxonomy mapped from proxy/service failures.
 *
 * - `service_unavailable` — upstream reader missing, timed out, or misconfigured
 * - `stale_dataset_version` — client requested a version the service no longer serves
 * - `corrupt_response` — JSON missing required fields or failing integrity checks
 * - `invalid_request` — safety limits, bad node id, or other rejected query
 */
export type ExplorerErrorCode =
  | "service_unavailable"
  | "stale_dataset_version"
  | "corrupt_response"
  | "invalid_request";
