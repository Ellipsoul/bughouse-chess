import { afterEach, describe, expect, it, vi } from "vitest";

describe("opening explorer local proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("forwards a metadata read to the loopback service", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_OPENING_EXPLORER", "true");
    vi.stubEnv("OPENING_EXPLORER_SERVICE_URL", "http://127.0.0.1:8765");
    const upstream = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({ dataset_version: "v1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", upstream);
    const { GET } = await import("@/app/api/opening-explorer/[...path]/route");

    const response = await GET(
      new Request("http://localhost:3000/api/opening-explorer/api/meta?dataset_version=v1"),
      { params: Promise.resolve({ path: ["api", "meta"] }) },
    );

    expect(upstream).toHaveBeenCalledOnce();
    expect(String(upstream.mock.calls[0][0])).toBe("http://127.0.0.1:8765/api/meta?dataset_version=v1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ dataset_version: "v1" });
  });

  it("does not expose the proxy when the local feature flag is disabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_OPENING_EXPLORER", "true");
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const { GET } = await import("@/app/api/opening-explorer/[...path]/route");

    const response = await GET(
      new Request("http://localhost:3000/api/opening-explorer/api/meta"),
      { params: Promise.resolve({ path: ["api", "meta"] }) },
    );

    expect(response.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects a non-loopback upstream without making a request", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_OPENING_EXPLORER", "true");
    vi.stubEnv("OPENING_EXPLORER_SERVICE_URL", "https://example.com");
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const { GET } = await import("@/app/api/opening-explorer/[...path]/route");

    const response = await GET(
      new Request("http://localhost:3000/api/opening-explorer/api/meta"),
      { params: Promise.resolve({ path: ["api", "meta"] }) },
    );

    expect(response.status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });
});
