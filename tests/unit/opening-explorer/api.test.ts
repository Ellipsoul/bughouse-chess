/**
 * Unit tests for {@link OpeningExplorerApi} — the browser-side HTTP client.
 *
 * Covers same-origin proxy URL construction, structured 503 error preservation,
 * abort-signal isolation (no cross-caller request reuse), correct `fetch` `this`
 * binding, and in-flight deduplication of identical neighborhood requests.
 */
import { describe, expect, it } from "vitest";
import { OpeningExplorerApi, OpeningExplorerApiError } from "@/app/components/opening-explorer/api";

describe("opening explorer HTTP client", () => {
  it("uses the same-origin local proxy by default", async () => {
    let requestedUrl = "";
    const fetcher: typeof fetch = async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({
        adapter_policy: "policy-v1",
        coverage: { accepted_games: 1, source_fingerprint: "fixture" },
        dataset_version: "v1",
        format_version: "packed-position-graph-v2",
        replay_policy: "skip-unreplayable-source-game-v1",
        root_node_id: 0,
        root_state_id: 0,
        terminal_policy: "last-shared-placement-plus-one-or-game-end-v1",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    await new OpeningExplorerApi(undefined, fetcher).metadata();

    expect(requestedUrl).toBe("/api/opening-explorer/api/meta");
  });

  it("preserves a service-unavailable response from the local proxy", async () => {
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({
      code: "service_unavailable",
      detail: "The local opening service is unavailable.",
    }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
    const api = new OpeningExplorerApi(undefined, fetcher);

    const error = await api.metadata().catch((caught) => caught);

    expect(error).toBeInstanceOf(OpeningExplorerApiError);
    expect(error).toMatchObject({ code: "service_unavailable", status: 503 });
  });

  it("does not reuse an aborted request for a new caller with a different signal", async () => {
    let calls = 0;
    const metadata = {
      adapter_policy: "policy-v1",
      coverage: { accepted_games: 1, source_fingerprint: "fixture" },
      dataset_version: "v1",
      format_version: "packed-position-graph-v1",
      replay_policy: "skip-unreplayable-source-game-v1",
      root_node_id: 0,
      root_state_id: 0,
      terminal_policy: "last-shared-placement-plus-one-or-game-end-v1",
    };
    const fetcher: typeof fetch = async (_input, init) => {
      calls += 1;
      if (calls === 2) {
        return new Response(JSON.stringify(metadata), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        }, { once: true });
      });
    };
    const api = new OpeningExplorerApi(undefined, fetcher);
    const firstController = new AbortController();
    const secondController = new AbortController();

    const first = api.metadata(firstController.signal);
    const second = api.metadata(secondController.signal);
    firstController.abort();

    await expect(first).rejects.toMatchObject({ name: "AbortError" });
    await expect(second).resolves.toEqual(metadata);
    expect(calls).toBe(2);
  });

  it("invokes the browser fetch function with the global receiver", async () => {
    const fetcher: typeof fetch = async function (this: unknown) {
      expect(this).toBe(globalThis);
      return new Response(JSON.stringify({
        adapter_policy: "policy-v1",
        coverage: { accepted_games: 1, source_fingerprint: "fixture" },
        dataset_version: "v1",
        format_version: "packed-position-graph-v1",
        replay_policy: "skip-unreplayable-source-game-v1",
        root_node_id: 0,
        root_state_id: 0,
        terminal_policy: "last-shared-placement-plus-one-or-game-end-v1",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    await new OpeningExplorerApi(undefined, fetcher).metadata();
  });

  it("deduplicates overlapping versioned neighborhood requests", async () => {
    const requestedUrls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      requestedUrls.push(String(input));
      return new Response(JSON.stringify({
        anchor_node_id: 4,
        anchor_state_id: 7,
        dataset_version: "v1",
        edges: [],
        filter: null,
        frontiers: [],
        instrumentation: {
          budget_exception: false,
          elapsed_microseconds: 1,
          encoded_bytes: 1,
          returned_edges: 0,
          returned_nodes: 0,
          returned_states: 0,
          visited_nodes: 0,
        },
        nodes: [{ id: 4, placement: "8/8/8/8/8/8/8/8", support: 1 }],
        states: [{
          id: 7,
          node_id: 4,
          outgoing_count: 0,
          position_fen: "8/8/8/8/8/8/8/8 w - -",
        }],
        node_overlays: { "4": { support: 1 } },
        state_overlays: {
          "7": {
            actual_ending_count: 0,
            results: { win: 1 },
            sole_game_ordinal: 0,
            support: 1,
          },
        },
        edge_overlays: {},
        target_forward_depth: 5,
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const api = new OpeningExplorerApi("http://127.0.0.1:8765", fetcher);

    const first = api.neighborhood({ datasetVersion: "v1", nodeId: 4, stateId: 7 });
    const second = api.neighborhood({ datasetVersion: "v1", nodeId: 4, stateId: 7 });
    await Promise.all([first, second]);

    expect(requestedUrls).toHaveLength(1);
    expect(requestedUrls[0]).toContain("/api/nodes/4/neighborhood?");
    expect(requestedUrls[0]).toContain("state_id=7");
  });

  it("rejects a neighborhood whose anchor state belongs to another node", async () => {
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({
      anchor_node_id: 4,
      anchor_state_id: 7,
      dataset_version: "v1",
      edges: [],
      filter: null,
      frontiers: [],
      instrumentation: {},
      nodes: [
        { id: 4, placement: "8/8/8/8/8/8/8/8", support: 1 },
        { id: 5, placement: "8/8/8/8/8/8/8/K7", support: 1 },
      ],
      states: [{
        id: 7,
        node_id: 5,
        outgoing_count: 0,
        position_fen: "8/8/8/8/8/8/8/K7 w - -",
      }],
      node_overlays: { "4": { support: 1 }, "5": { support: 1 } },
      state_overlays: {
        "7": { actual_ending_count: 0, results: {}, sole_game_ordinal: 0, support: 1 },
      },
      edge_overlays: {},
      target_forward_depth: 5,
    }), { status: 200, headers: { "content-type": "application/json" } });

    await expect(new OpeningExplorerApi(undefined, fetcher).neighborhood({
      datasetVersion: "v1",
      nodeId: 4,
      stateId: 7,
    })).rejects.toMatchObject({ code: "corrupt_response" });
  });

  it("rejects neighborhood overlays returned for a different player filter", async () => {
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({
      anchor_node_id: 4,
      anchor_state_id: 7,
      dataset_version: "v1",
      edges: [],
      filter: { white_username: "bob", black_username: null },
      frontiers: [],
      instrumentation: {},
      nodes: [{ id: 4, placement: "8/8/8/8/8/8/8/8", support: 1 }],
      states: [{
        id: 7,
        node_id: 4,
        outgoing_count: 0,
        position_fen: "8/8/8/8/8/8/8/8 w - -",
      }],
      node_overlays: { "4": { support: 1 } },
      state_overlays: {
        "7": { actual_ending_count: 0, results: {}, sole_game_ordinal: 0, support: 1 },
      },
      edge_overlays: {},
      target_forward_depth: 5,
    }), { status: 200, headers: { "content-type": "application/json" } });

    await expect(new OpeningExplorerApi(undefined, fetcher).neighborhood({
      datasetVersion: "v1",
      nodeId: 4,
      stateId: 7,
      filter: { white: "alice", black: null },
    })).rejects.toMatchObject({ code: "corrupt_response" });
  });

  it("loads source games from the traversed edge endpoint", async () => {
    let requestedUrl = "";
    const fetcher: typeof fetch = async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({
        actual_ending_count: 0,
        dataset_version: "v1",
        edge_id: 19,
        games: [],
        limit: 1,
        total_matching: 0,
      }), { status: 200, headers: { "content-type": "application/json" } });
    };

    await new OpeningExplorerApi(undefined, fetcher).edgeGameExamples(
      "v1",
      19,
      { white: "alice", black: null },
      1,
    );

    expect(requestedUrl).toContain("/api/edges/19/games?");
    expect(requestedUrl).toContain("white=alice");
  });
});
