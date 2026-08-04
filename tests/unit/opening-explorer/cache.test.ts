/**
 * Unit tests for {@link OpeningExplorerCache} and filter-key normalization.
 *
 * Validates bounded in-memory cache semantics: overlay keys scoped by normalized
 * player filter, LRU eviction of unpinned structural nodes, pinned ancestor
 * retention under capacity pressure, and frontier staleness when children are
 * evicted.
 */
import { describe, expect, it } from "vitest";
import { OpeningExplorerCache, normalizedFilterKey } from "@/app/components/opening-explorer/cache";
import type { NeighborhoodResponse } from "@/app/components/opening-explorer/types";

/**
 * Builds a synthetic {@link NeighborhoodResponse} whose node ids follow `ids[0]`
 * as anchor with star-shaped edges to remaining ids.
 *
 * @param ids - Anchor first, then child node ids.
 * @param filter - Optional player filter echoed on the response.
 */
function response(ids: number[], filter: NeighborhoodResponse["filter"] = null): NeighborhoodResponse {
  return {
    anchor_node_id: ids[0],
    dataset_version: "dataset-1",
    edges: ids.slice(1).map((id) => ({ child_id: id, move_token: `t${id}`, parent_id: ids[0] })),
    filter,
    frontiers: [],
    instrumentation: {
      budget_exception: false,
      elapsed_microseconds: 1,
      encoded_bytes: 10,
      returned_edges: Math.max(0, ids.length - 1),
      returned_nodes: ids.length,
      visited_nodes: ids.length,
    },
    nodes: ids.map((id) => ({
      child_count: 0,
      id,
      interval_end: id + 1,
      interval_start: id,
      move_token: id === ids[0] ? null : `t${id}`,
      parent_id: id === ids[0] ? null : ids[0],
      ply: id,
    })),
    overlays: Object.fromEntries(ids.map((id) => [String(id), {
      actual_ending_count: 0,
      results: {},
      sole_game_ordinal: null,
      support: 1,
    }])),
    path: [{ move_token: null, node_id: 0 }],
    target_forward_depth: 5,
  };
}

/**
 * Attaches budget frontiers to a neighborhood response so cache tests can
 * assert frontier replacement and parent incompleteness after eviction.
 */
function withFrontiers(
  value: NeighborhoodResponse,
  nodeIds: number[],
): NeighborhoodResponse {
  return {
    ...value,
    frontiers: nodeIds.map((nodeId) => ({ has_more: true, node_id: nodeId, reason: "budget" as const })),
  };
}

describe("opening explorer bounded cache", () => {
  it("keys overlays by normalized filter and evicts only unpinned structural nodes", () => {
    const cache = new OpeningExplorerCache(3);
    cache.merge(response([0, 1, 2], { white_username: "alice", black_username: null }));
    cache.pin("dataset-1", [0, 1]);
    expect(cache.getNode("dataset-1", 1)?.id).toBe(1);

    cache.merge(response([0, 3]));

    expect(cache.hasNode("dataset-1", 0)).toBe(true);
    expect(cache.hasNode("dataset-1", 1)).toBe(true);
    expect(cache.hasNode("dataset-1", 2)).toBe(false);
    expect(cache.hasNode("dataset-1", 3)).toBe(true);
    expect(normalizedFilterKey({ white: " Alice ", black: "BOB" })).toBe("white=alice&black=bob");
    expect(cache.metrics()).toMatchObject({ cacheHits: 1, evictedNodes: 1, returnedNodes: 5 });
  });

  it("replaces stale frontier state and marks a parent incomplete when one of its children is evicted", () => {
    const cache = new OpeningExplorerCache(2);
    cache.merge(withFrontiers(response([0, 1]), [0]));

    expect(cache.isFrontier("dataset-1", 0)).toBe(true);

    cache.merge(response([0, 1]));
    expect(cache.isFrontier("dataset-1", 0)).toBe(false);

    cache.pin("dataset-1", [0]);
    cache.merge(response([2]));

    expect(cache.hasNode("dataset-1", 1)).toBe(false);
    expect(cache.isFrontier("dataset-1", 0)).toBe(true);
  });
});
