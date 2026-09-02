/** Bounded graph cache keyed by dataset, state occurrence, edge, and filter. */

import type {
  EdgeOverlay,
  ExplorerFilter,
  NeighborhoodResponse,
  NodeOverlay,
  StateOverlay,
  StructuralEdge,
  StructuralNode,
  StructuralState,
} from "./types";

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
  private readonly maximumStates: number;
  private activeVersion: string | null = null;
  private nodes = new Map<string, StructuralNode>();
  private states = new Map<string, StructuralState>();
  private nodeOverlays = new Map<string, NodeOverlay>();
  private stateOverlays = new Map<string, StateOverlay>();
  private edgeOverlays = new Map<string, EdgeOverlay>();
  private edges = new Map<string, Map<number, StructuralEdge>>();
  private reverseParents = new Map<string, Set<number>>();
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

  constructor(maximumStates = 5_000) {
    if (maximumStates < 1) throw new Error("maximumStates must be positive");
    this.maximumStates = maximumStates;
  }

  private nodeKey(version: string, nodeId: number): string {
    return `${version}:node:${nodeId}`;
  }

  private stateKey(version: string, stateId: number): string {
    return `${version}:state:${stateId}`;
  }

  private overlayKey(
    version: string,
    filterKey: string,
    kind: "node" | "state" | "edge",
    id: number,
  ): string {
    return `${version}:${filterKey}:${kind}:${id}`;
  }

  private deleteOverlays(kind: "node" | "state" | "edge", id: number): void {
    const overlays = kind === "node"
      ? this.nodeOverlays
      : kind === "state"
        ? this.stateOverlays
        : this.edgeOverlays;

    for (const key of overlays.keys()) {
      if (key.endsWith(`:${kind}:${id}`)) overlays.delete(key);
    }
  }

  activateDataset(version: string): void {
    if (this.activeVersion === version) return;
    this.activeVersion = version;
    this.nodes.clear();
    this.states.clear();
    this.nodeOverlays.clear();
    this.stateOverlays.clear();
    this.edgeOverlays.clear();
    this.edges.clear();
    this.reverseParents.clear();
    this.frontiers.clear();
    this.recency.clear();
    this.pinned.clear();
  }

  merge(response: NeighborhoodResponse): void {
    this.activateDataset(response.dataset_version);
    const filterKey = responseFilterKey(response.filter);
    this.counters.returnedNodes += response.states.length;

    for (const node of response.nodes) {
      this.nodes.set(this.nodeKey(response.dataset_version, node.id), node);
      const overlay = response.node_overlays[String(node.id)];
      if (overlay) {
        this.nodeOverlays.set(
          this.overlayKey(response.dataset_version, filterKey, "node", node.id),
          overlay,
        );
      }
    }

    for (const state of response.states) {
      const key = this.stateKey(response.dataset_version, state.id);
      this.states.set(key, state);
      this.recency.set(key, ++this.tick);
      this.frontiers.delete(key);
      const overlay = response.state_overlays[String(state.id)];
      if (overlay) {
        this.stateOverlays.set(
          this.overlayKey(response.dataset_version, filterKey, "state", state.id),
          overlay,
        );
      }
    }

    for (const edge of response.edges) {
      const parentKey = this.stateKey(response.dataset_version, edge.parent_state_id);
      const outgoing = this.edges.get(parentKey) ?? new Map<number, StructuralEdge>();
      outgoing.set(edge.id, edge);
      this.edges.set(parentKey, outgoing);

      const childKey = this.stateKey(response.dataset_version, edge.child_state_id);
      const parents = this.reverseParents.get(childKey) ?? new Set<number>();
      parents.add(edge.parent_state_id);
      this.reverseParents.set(childKey, parents);

      const overlay = response.edge_overlays[String(edge.id)];
      if (overlay) {
        this.edgeOverlays.set(
          this.overlayKey(response.dataset_version, filterKey, "edge", edge.id),
          overlay,
        );
      }
    }

    for (const frontier of response.frontiers) {
      this.frontiers.add(this.stateKey(response.dataset_version, frontier.state_id));
    }
    this.evict();
  }

  pin(version: string, stateIds: readonly number[]): void {
    this.pinned = new Set(stateIds.map((stateId) => this.stateKey(version, stateId)));
    this.evict();
  }

  hasState(version: string, stateId: number): boolean {
    return this.states.has(this.stateKey(version, stateId));
  }

  getNode(version: string, nodeId: number): StructuralNode | undefined {
    return this.nodes.get(this.nodeKey(version, nodeId));
  }

  getState(version: string, stateId: number): StructuralState | undefined {
    const key = this.stateKey(version, stateId);
    const state = this.states.get(key);
    if (!state) {
      this.counters.cacheMisses += 1;
      return undefined;
    }
    this.counters.cacheHits += 1;
    this.counters.usedNodes += 1;
    this.recency.set(key, ++this.tick);
    return state;
  }

  getNodeOverlay(version: string, nodeId: number, filter: ExplorerFilter): NodeOverlay | undefined {
    return this.nodeOverlays.get(
      this.overlayKey(version, normalizedFilterKey(filter), "node", nodeId),
    );
  }

  getStateOverlay(version: string, stateId: number, filter: ExplorerFilter): StateOverlay | undefined {
    return this.stateOverlays.get(
      this.overlayKey(version, normalizedFilterKey(filter), "state", stateId),
    );
  }

  getEdgeOverlay(version: string, edgeId: number, filter: ExplorerFilter): EdgeOverlay | undefined {
    return this.edgeOverlays.get(
      this.overlayKey(version, normalizedFilterKey(filter), "edge", edgeId),
    );
  }

  getChildren(version: string, stateId: number): StructuralEdge[] {
    return [...(this.edges.get(this.stateKey(version, stateId))?.values() ?? [])]
      .filter((edge) => this.hasState(version, edge.child_state_id))
      .sort((left, right) => left.move_label.localeCompare(right.move_label) || left.id - right.id);
  }

  isFrontier(version: string, stateId: number): boolean {
    return this.frontiers.has(this.stateKey(version, stateId));
  }

  metrics(): CacheMetrics {
    return { ...this.counters };
  }

  private evict(): void {
    while (this.states.size > this.maximumStates) {
      let candidate: string | null = null;
      let oldest = Number.POSITIVE_INFINITY;
      for (const [key, tick] of this.recency) {
        if (!this.pinned.has(key) && tick < oldest) {
          candidate = key;
          oldest = tick;
        }
      }
      if (!candidate) break;

      const state = this.states.get(candidate);
      const outgoing = [...(this.edges.get(candidate)?.values() ?? [])];
      this.states.delete(candidate);
      this.recency.delete(candidate);
      this.edges.delete(candidate);
      this.frontiers.delete(candidate);

      if (state) {
        const parents = this.reverseParents.get(candidate) ?? new Set<number>();
        for (const parentStateId of parents) {
          const parentKey = this.stateKey(this.activeVersion!, parentStateId);
          if (this.states.has(parentKey)) this.frontiers.add(parentKey);
        }
        this.reverseParents.delete(candidate);
        for (const edge of outgoing) {
          const childKey = this.stateKey(this.activeVersion!, edge.child_state_id);
          const childParents = this.reverseParents.get(childKey);
          childParents?.delete(state.id);
          if (childParents?.size === 0) this.reverseParents.delete(childKey);
          this.deleteOverlays("edge", edge.id);
        }
        const nodeStillUsed = [...this.states.values()].some(
          (cached) => cached.node_id === state.node_id,
        );
        if (!nodeStillUsed) {
          this.nodes.delete(this.nodeKey(this.activeVersion!, state.node_id));
          this.deleteOverlays("node", state.node_id);
        }
        this.deleteOverlays("state", state.id);
      }
      this.counters.evictedNodes += 1;
    }
  }
}
