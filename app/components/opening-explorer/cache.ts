/**
 * @module opening-explorer/cache
 *
 * Bounded in-memory cache for opening-explorer neighborhoods.
 *
 * Structural nodes and edges are keyed by `(dataset_version, node_id)`.
 * Filter overlays are keyed by `(dataset_version, normalized_filter, node_id)`
 * so changing a player filter does not discard reusable geometry.
 *
 * The visited path and its immediate children are pinned against LRU eviction
 * so ordinary backward navigation stays local and instant. Evicting a child
 * re-marks its parent as a frontier so idle prefetch can refill it later.
 *
 * Native HTTP caching remains a second tier beneath this working set; this
 * module is intentionally the fast, bounded first tier (default 5,000 nodes).
 */

import type {
  ExplorerFilter,
  NeighborhoodResponse,
  NodeOverlay,
  StructuralEdge,
  StructuralNode,
} from "./types";

/**
 * Builds a stable cache identity for a White/Black filter.
 *
 * Usernames are trimmed and lower-cased so typographically equivalent inputs
 * share overlay entries.
 *
 * @param filter - Seat filter from the UI or a response echo.
 */
export function normalizedFilterKey(filter: ExplorerFilter): string {
  const white = filter.white?.trim().toLocaleLowerCase() ?? "";
  const black = filter.black?.trim().toLocaleLowerCase() ?? "";

  return `white=${white}&black=${black}`;
}

/**
 * Converts a service filter echo into the same key used by client state.
 *
 * @param filter - Neighborhood response filter object, possibly null.
 */
function responseFilterKey(filter: NeighborhoodResponse["filter"]): string {
  return normalizedFilterKey({
    white: filter?.white_username ?? null,
    black: filter?.black_username ?? null,
  });
}

/**
 * Running counters exposed for the prototype instrumentation panel.
 */
interface CacheMetrics {
  cacheHits: number;
  cacheMisses: number;
  evictedNodes: number;
  returnedNodes: number;
  usedNodes: number;
}

/**
 * Versioned LRU cache for structural nodes, edges, overlays, and frontiers.
 */
export class OpeningExplorerCache {
  private readonly maximumNodes: number;
  private activeVersion: string | null = null;
  private structures = new Map<string, StructuralNode>();
  private overlays = new Map<string, NodeOverlay>();
  private edges = new Map<string, Map<number, StructuralEdge>>();
  private frontiers = new Set<string>();
  private recency = new Map<string, number>();
  private pinned = new Set<string>();
  private tick = 0;
  private counters: CacheMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    evictedNodes: 0,
    returnedNodes: 0,
    usedNodes: 0,
  };

  /**
   * @param maximumNodes - Maximum structural nodes retained before LRU eviction.
   */
  constructor(maximumNodes = 5_000) {
    if (maximumNodes < 1) {
      throw new Error("maximumNodes must be positive");
    }

    this.maximumNodes = maximumNodes;
  }

  /**
   * Builds the structural cache key for a versioned node.
   *
   * @param version - Active dataset version.
   * @param nodeId - Structural node id.
   */
  private key(version: string, nodeId: number): string {
    return `${version}:${nodeId}`;
  }

  /**
   * Builds the overlay cache key for a versioned, filtered node.
   *
   * @param version - Active dataset version.
   * @param filterKey - Output of {@link normalizedFilterKey}.
   * @param nodeId - Structural node id.
   */
  private overlayKey(version: string, filterKey: string, nodeId: number): string {
    return `${version}:${filterKey}:${nodeId}`;
  }

  /**
   * Switches the active dataset version, clearing all retained records.
   *
   * Idempotent when the version is unchanged so repeated metadata loads do not
   * thrash a warm cache.
   *
   * @param version - Newly published dataset version.
   */
  activateDataset(version: string): void {
    if (this.activeVersion === version) return;

    this.activeVersion = version;
    this.structures.clear();
    this.overlays.clear();
    this.edges.clear();
    this.frontiers.clear();
    this.recency.clear();
    this.pinned.clear();
  }

  /**
   * Merges a neighborhood response into structural, edge, overlay, and frontier maps.
   *
   * Nodes present in the response lose any previous frontier mark. Eviction runs
   * after the merge so the working set never permanently exceeds `maximumNodes`.
   *
   * @param response - Validated neighborhood payload from the API client.
   */
  merge(response: NeighborhoodResponse): void {
    this.activateDataset(response.dataset_version);

    const filterKey = responseFilterKey(response.filter);

    this.counters.returnedNodes += response.nodes.length;

    for (const node of response.nodes) {
      const key = this.key(response.dataset_version, node.id);

      this.structures.set(key, node);
      this.recency.set(key, ++this.tick);
      this.frontiers.delete(key);

      const overlay = response.overlays[String(node.id)];

      if (overlay) {
        this.overlays.set(
          this.overlayKey(response.dataset_version, filterKey, node.id),
          overlay,
        );
      }
    }

    for (const edge of response.edges) {
      const parentKey = this.key(response.dataset_version, edge.parent_id);
      const children = this.edges.get(parentKey) ?? new Map<number, StructuralEdge>();

      children.set(edge.child_id, edge);
      this.edges.set(parentKey, children);
    }

    for (const frontier of response.frontiers) {
      this.frontiers.add(this.key(response.dataset_version, frontier.node_id));
    }

    this.evict();
  }

  /**
   * Pins the given nodes against LRU eviction (typically the active path).
   *
   * Replaces the previous pin set entirely, then evicts if needed.
   *
   * @param version - Active dataset version.
   * @param nodeIds - Node ids that must remain resident.
   */
  pin(version: string, nodeIds: readonly number[]): void {
    this.pinned = new Set(nodeIds.map((nodeId) => this.key(version, nodeId)));
    this.evict();
  }

  /**
   * Reports whether a structural node is currently resident.
   *
   * @param version - Active dataset version.
   * @param nodeId - Structural node id.
   */
  hasNode(version: string, nodeId: number): boolean {
    return this.structures.has(this.key(version, nodeId));
  }

  /**
   * Returns a structural node and records a cache hit/miss.
   *
   * Hits refresh LRU recency and increment `usedNodes` for instrumentation.
   *
   * @param version - Active dataset version.
   * @param nodeId - Structural node id.
   */
  getNode(version: string, nodeId: number): StructuralNode | undefined {
    const key = this.key(version, nodeId);
    const node = this.structures.get(key);

    if (!node) {
      this.counters.cacheMisses += 1;
      return undefined;
    }

    this.counters.cacheHits += 1;
    this.counters.usedNodes += 1;
    this.recency.set(key, ++this.tick);

    return node;
  }

  /**
   * Returns the filter overlay for a node, if one was previously merged.
   *
   * @param version - Active dataset version.
   * @param nodeId - Structural node id.
   * @param filter - Active seat filter.
   */
  getOverlay(version: string, nodeId: number, filter: ExplorerFilter): NodeOverlay | undefined {
    return this.overlays.get(
      this.overlayKey(version, normalizedFilterKey(filter), nodeId),
    );
  }

  /**
   * Lists immediate child edges whose child nodes are still resident.
   *
   * Edges whose children were evicted are omitted so the UI never offers a
   * continuation that cannot be rendered from cache without a refill.
   *
   * @param version - Active dataset version.
   * @param nodeId - Parent node id.
   */
  getChildren(version: string, nodeId: number): StructuralEdge[] {
    return [...(this.edges.get(this.key(version, nodeId))?.values() ?? [])]
      .filter((edge) => this.hasNode(version, edge.child_id))
      .sort((left, right) => left.move_token.localeCompare(right.move_token));
  }

  /**
   * Reports whether a node is marked as a truncated expansion frontier.
   *
   * @param version - Active dataset version.
   * @param nodeId - Structural node id.
   */
  isFrontier(version: string, nodeId: number): boolean {
    return this.frontiers.has(this.key(version, nodeId));
  }

  /**
   * Returns a snapshot of instrumentation counters.
   */
  metrics(): CacheMetrics {
    return { ...this.counters };
  }

  /**
   * Evicts the oldest unpinned structural nodes until size fits the budget.
   *
   * When a child is evicted, its parent is re-marked as a frontier so idle
   * prefetch can refill the missing neighborhood later. Matching overlays for
   * the evicted node id are also removed.
   */
  private evict(): void {
    while (this.structures.size > this.maximumNodes) {
      let candidate: string | null = null;
      let oldest = Number.POSITIVE_INFINITY;

      for (const [key, tick] of this.recency) {
        if (!this.pinned.has(key) && tick < oldest) {
          candidate = key;
          oldest = tick;
        }
      }

      if (!candidate) break;

      const evictedNode = this.structures.get(candidate);

      this.structures.delete(candidate);
      this.recency.delete(candidate);
      this.edges.delete(candidate);
      this.frontiers.delete(candidate);

      if (evictedNode?.parent_id !== null && evictedNode?.parent_id !== undefined) {
        const parentKey = this.key(this.activeVersion!, evictedNode.parent_id);

        if (this.structures.has(parentKey)) {
          this.frontiers.add(parentKey);
        }
      }

      for (const key of this.overlays.keys()) {
        if (key.endsWith(`:${candidate.split(":").at(-1)}`)) {
          this.overlays.delete(key);
        }
      }

      this.counters.evictedNodes += 1;
    }
  }
}
