import type { ExplorerFilter, NeighborhoodResponse, NodeOverlay, StructuralEdge, StructuralNode } from "./types";

export function normalizedFilterKey(filter: ExplorerFilter): string {
  const white = filter.white?.trim().toLocaleLowerCase() ?? "";
  const black = filter.black?.trim().toLocaleLowerCase() ?? "";
  return `white=${white}&black=${black}`;
}

function responseFilterKey(filter: NeighborhoodResponse["filter"]): string {
  return normalizedFilterKey({
    white: filter?.white_username ?? null,
    black: filter?.black_username ?? null,
  });
}

interface CacheMetrics {
  cacheHits: number;
  cacheMisses: number;
  evictedNodes: number;
  returnedNodes: number;
  usedNodes: number;
}

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

  constructor(maximumNodes = 5_000) {
    if (maximumNodes < 1) throw new Error("maximumNodes must be positive");
    this.maximumNodes = maximumNodes;
  }

  private key(version: string, nodeId: number): string {
    return `${version}:${nodeId}`;
  }

  private overlayKey(version: string, filterKey: string, nodeId: number): string {
    return `${version}:${filterKey}:${nodeId}`;
  }

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
        this.overlays.set(this.overlayKey(response.dataset_version, filterKey, node.id), overlay);
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

  pin(version: string, nodeIds: readonly number[]): void {
    this.pinned = new Set(nodeIds.map((nodeId) => this.key(version, nodeId)));
    this.evict();
  }

  hasNode(version: string, nodeId: number): boolean {
    return this.structures.has(this.key(version, nodeId));
  }

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

  getOverlay(version: string, nodeId: number, filter: ExplorerFilter): NodeOverlay | undefined {
    return this.overlays.get(this.overlayKey(version, normalizedFilterKey(filter), nodeId));
  }

  getChildren(version: string, nodeId: number): StructuralEdge[] {
    return [...(this.edges.get(this.key(version, nodeId))?.values() ?? [])]
      .filter((edge) => this.hasNode(version, edge.child_id))
      .sort((left, right) => left.move_token.localeCompare(right.move_token));
  }

  isFrontier(version: string, nodeId: number): boolean {
    return this.frontiers.has(this.key(version, nodeId));
  }

  metrics(): CacheMetrics {
    return { ...this.counters };
  }

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
        if (this.structures.has(parentKey)) this.frontiers.add(parentKey);
      }
      for (const key of this.overlays.keys()) {
        if (key.endsWith(`:${candidate.split(":").at(-1)}`)) this.overlays.delete(key);
      }
      this.counters.evictedNodes += 1;
    }
  }
}
