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
        format_version: "packed-v1",
        root_node_id: 0,
        terminal_policy: "terminal-v1",
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
      format_version: "packed-v1",
      root_node_id: 0,
      terminal_policy: "terminal-v1",
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
        format_version: "packed-v1",
        root_node_id: 0,
        terminal_policy: "terminal-v1",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    await new OpeningExplorerApi(undefined, fetcher).metadata();
  });

  it("deduplicates overlapping versioned neighborhood requests", async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({
        anchor_node_id: 4,
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
          visited_nodes: 0,
        },
        nodes: [],
        overlays: {},
        path: [],
        target_forward_depth: 5,
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const api = new OpeningExplorerApi("http://127.0.0.1:8765", fetcher);

    const first = api.neighborhood({ datasetVersion: "v1", nodeId: 4 });
    const second = api.neighborhood({ datasetVersion: "v1", nodeId: 4 });
    await Promise.all([first, second]);

    expect(calls).toBe(1);
  });
});
