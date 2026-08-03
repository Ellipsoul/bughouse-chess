import { afterEach, describe, expect, it, vi } from "vitest";

describe("opening explorer local proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("forwards a metadata read to the loopback service", async () => {
    vi.stubEnv("NODE_ENV", "development");
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

  it("preserves immutable validators across the same-origin boundary", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const upstream = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("if-none-match")).toBe('"dataset-response"');
      return new Response(null, {
        status: 304,
        headers: {
          "cache-control": "private, max-age=31536000, immutable",
          etag: '"dataset-response"',
          "server-timing": "reader;dur=1.250",
        },
      });
    });
    vi.stubGlobal("fetch", upstream);
    const { GET } = await import("@/app/api/opening-explorer/[...path]/route");

    const response = await GET(
      new Request("http://localhost:3000/api/opening-explorer/api/meta", {
        headers: { "if-none-match": '"dataset-response"' },
      }),
      { params: Promise.resolve({ path: ["api", "meta"] }) },
    );

    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe('"dataset-response"');
    expect(response.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
    expect(response.headers.get("server-timing")).toBe("reader;dur=1.250");
  });

  it("forwards hosted reads only to an exact HTTPS allowlist entry with a server-side credential", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPENING_EXPLORER_SERVICE_URL", "https://opening-service.example/base-is-rejected");
    vi.stubEnv("OPENING_EXPLORER_SERVICE_ALLOWED_ORIGINS", "https://opening-service.example");
    vi.stubEnv("OPENING_EXPLORER_SERVICE_TOKEN", "server-secret");
    const upstream = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return Response.json({ dataset_version: "v1" });
    });
    vi.stubGlobal("fetch", upstream);
    const { GET } = await import("@/app/api/opening-explorer/[...path]/route");

    vi.stubEnv("OPENING_EXPLORER_SERVICE_URL", "http://127.0.0.1:8765");
    const loopback = await GET(
      new Request("https://preview.example.test/api/opening-explorer/api/meta"),
      { params: Promise.resolve({ path: ["api", "meta"] }) },
    );
    expect(loopback.status).toBe(503);

    vi.stubEnv("OPENING_EXPLORER_SERVICE_URL", "https://opening-service.example/base-is-rejected");
    const rejected = await GET(
      new Request("https://preview.example.test/api/opening-explorer/api/meta"),
      { params: Promise.resolve({ path: ["api", "meta"] }) },
    );
    expect(rejected.status).toBe(503);

    vi.stubEnv("OPENING_EXPLORER_SERVICE_URL", "https://opening-service.example");
    const accepted = await GET(
      new Request("https://preview.example.test/api/opening-explorer/api/meta"),
      { params: Promise.resolve({ path: ["api", "meta"] }) },
    );

    expect(accepted.status).toBe(200);
    expect(String(upstream.mock.calls[0][0])).toBe("https://opening-service.example/api/meta");
    expect(new Headers(upstream.mock.calls[0][1]?.headers).get("authorization")).toBe("Bearer server-secret");
  });

  it("forwards production reads through the server-only service boundary", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPENING_EXPLORER_SERVICE_URL", "https://opening-service.example");
    vi.stubEnv("OPENING_EXPLORER_SERVICE_ALLOWED_ORIGINS", "https://opening-service.example");
    vi.stubEnv("OPENING_EXPLORER_SERVICE_TOKEN", "server-secret");
    const upstream = vi.fn(async () => Response.json({ dataset_version: "v1" }));
    vi.stubGlobal("fetch", upstream);
    const { GET } = await import("@/app/api/opening-explorer/[...path]/route");

    const response = await GET(
      new Request("https://bughouse.aronteh.com/api/opening-explorer/api/meta"),
      { params: Promise.resolve({ path: ["api", "meta"] }) },
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("forwards requests without availability configuration", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OPENING_EXPLORER_SERVICE_URL", "http://127.0.0.1:8765");
    const upstream = vi.fn(async () => Response.json({ dataset_version: "v1" }));
    vi.stubGlobal("fetch", upstream);
    const { GET } = await import("@/app/api/opening-explorer/[...path]/route");

    const response = await GET(
      new Request("http://localhost:3000/api/opening-explorer/api/meta"),
      { params: Promise.resolve({ path: ["api", "meta"] }) },
    );

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("rejects a non-loopback upstream without making a request", async () => {
    vi.stubEnv("NODE_ENV", "development");
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
