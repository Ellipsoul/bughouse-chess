/**
 * @module api/opening-explorer
 *
 * Same-origin read proxy for the opening explorer service.
 *
 * The browser never learns the upstream origin or bearer token. This route:
 * - allowlists only metadata, neighborhood, games, and player-prefix GET shapes
 * - forwards query strings and cache validators without transforming bodies
 * - permits loopback HTTP in non-production, or HTTPS origins on an explicit
 *   allowlist with a required server-only credential in hosted environments
 * - returns bounded JSON errors (`404` unknown path, `503` unavailable upstream)
 *
 * Server-only configuration:
 * - `OPENING_EXPLORER_SERVICE_URL`
 * - `OPENING_EXPLORER_SERVICE_ALLOWED_ORIGINS`
 * - `OPENING_EXPLORER_SERVICE_TOKEN`
 * - `OPENING_EXPLORER_SERVICE_TIMEOUT_MS`
 */

interface RouteContext {
  /** Next.js App Router params promise containing the catch-all path segments. */
  params: Promise<{ path: string[] }>;
}

/** Hostnames treated as safe loopback for local HTTP development. */
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** Default upstream timeout when the env override is absent. */
const DEFAULT_TIMEOUT_MS = 45_000;

/** Keep the proxy alive long enough for a full-artifact Large Function cold start. */
export const maxDuration = 60;

/**
 * Returns whether the catch-all path matches an allowed read operation.
 *
 * Allowed shapes:
 * - `api/meta`
 * - `api/players`
 * - `api/nodes/{digits}/neighborhood`
 * - `api/nodes/{digits}/games`
 *
 * @param path - Path segments after `/api/opening-explorer/`.
 */
function isAllowedReadPath(path: string[]): boolean {
  if (path.length === 2 && path[0] === "api" && (path[1] === "meta" || path[1] === "players")) {
    return true;
  }

  return path.length === 4
    && path[0] === "api"
    && path[1] === "nodes"
    && /^\d+$/.test(path[2])
    && (path[3] === "neighborhood" || path[3] === "games");
}

/**
 * Parses the comma-separated HTTPS origin allowlist from the environment.
 */
function configuredAllowedOrigins(): Set<string> {
  return new Set(
    (process.env.OPENING_EXPLORER_SERVICE_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => new URL(value).origin),
  );
}

/**
 * Resolves and validates the upstream service origin and optional bearer token.
 *
 * Loopback HTTP is permitted only outside production. Hosted origins must be
 * HTTPS, allowlisted, and accompanied by `OPENING_EXPLORER_SERVICE_TOKEN`.
 *
 * @throws If the URL contains credentials/path junk, is not allowlisted, or
 *   lacks a hosted credential.
 */
function serviceOrigin(): { origin: URL; token?: string } {
  const origin = new URL(process.env.OPENING_EXPLORER_SERVICE_URL ?? "http://127.0.0.1:8765");

  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("Opening explorer service URL must be a bare origin without credentials.");
  }

  if (origin.protocol === "http:" && LOOPBACK_HOSTS.has(origin.hostname)) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Opening explorer Preview service must use HTTPS.");
    }

    return { origin };
  }

  if (origin.protocol !== "https:" || !configuredAllowedOrigins().has(origin.origin)) {
    throw new Error("Opening explorer hosted service origin is not allowlisted.");
  }

  const token = process.env.OPENING_EXPLORER_SERVICE_TOKEN;

  if (!token) {
    throw new Error("Opening explorer hosted service credential is missing.");
  }

  return { origin, token };
}

/**
 * Reads and validates the upstream timeout override.
 *
 * @throws If the value is not an integer between 100 and 60_000 ms.
 */
function serviceTimeoutMs(): number {
  const configured = Number(process.env.OPENING_EXPLORER_SERVICE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

  if (!Number.isInteger(configured) || configured < 100 || configured > 60_000) {
    throw new Error("Opening explorer service timeout must be between 100 and 60000 milliseconds.");
  }

  return configured;
}

/**
 * Builds a small JSON error response for proxy failures.
 *
 * @param status - HTTP status code.
 * @param code - Stable machine-readable error code.
 * @param detail - Human-readable explanation.
 */
function jsonError(status: number, code: string, detail: string): Response {
  return Response.json({ code, detail }, { status });
}

/**
 * Proxies an allowlisted opening-explorer GET to the configured upstream.
 *
 * Unknown paths return `404`. Misconfiguration or upstream transport failures
 * return `503`. Successful responses preserve selected cache/timing headers and
 * stream the body without transformation.
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;

  if (!isAllowedReadPath(path)) {
    return jsonError(404, "invalid_proxy_path", "Unknown opening explorer operation.");
  }

  let upstream: URL;
  let authorization: string | undefined;
  let timeoutMs: number;

  try {
    const service = serviceOrigin();

    upstream = new URL(`/${path.join("/")}`, service.origin);
    authorization = service.token ? `Bearer ${service.token}` : undefined;
    timeoutMs = serviceTimeoutMs();
  } catch {
    return jsonError(503, "service_unavailable", "The opening service is unavailable.");
  }

  upstream.search = new URL(request.url).search;

  try {
    const validator = request.headers.get("if-none-match");
    const upstreamStarted = performance.now();

    const response = await fetch(upstream, {
      headers: {
        accept: "application/json",
        ...(authorization ? { authorization } : {}),
        ...(validator ? { "if-none-match": validator } : {}),
      },
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)]),
    });
    const upstreamDurationMs = performance.now() - upstreamStarted;

    const responseHeaders = new Headers();

    for (const name of ["cache-control", "content-type", "etag", "server-timing", "vary"]) {
      const value = response.headers.get(name);

      if (value) {
        responseHeaders.set(name, value);
      }
    }

    const readerTiming = responseHeaders.get("server-timing");
    const proxyTiming = `proxy-upstream;dur=${upstreamDurationMs.toFixed(3)}`;

    responseHeaders.set(
      "server-timing",
      readerTiming ? `${readerTiming}, ${proxyTiming}` : proxyTiming,
    );

    if (!responseHeaders.has("content-type") && response.status !== 304) {
      responseHeaders.set("content-type", "application/json");
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return jsonError(503, "service_unavailable", "The opening service is unavailable.");
  }
}
