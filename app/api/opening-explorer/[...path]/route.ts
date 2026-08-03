import { openingExplorerEnabledForServerRequest } from "@/app/components/opening-explorer/featureFlag";

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const DEFAULT_TIMEOUT_MS = 5_000;

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

function configuredAllowedOrigins(): Set<string> {
  return new Set(
    (process.env.OPENING_EXPLORER_SERVICE_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => new URL(value).origin),
  );
}

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
  if (!token) throw new Error("Opening explorer hosted service credential is missing.");
  return { origin, token };
}

function serviceTimeoutMs(): number {
  const configured = Number(process.env.OPENING_EXPLORER_SERVICE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isInteger(configured) || configured < 100 || configured > 10_000) {
    throw new Error("Opening explorer service timeout must be between 100 and 10000 milliseconds.");
  }
  return configured;
}

function jsonError(status: number, code: string, detail: string): Response {
  return Response.json({ code, detail }, { status });
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  if (!openingExplorerEnabledForServerRequest(new URL(request.url).host)) {
    return jsonError(404, "feature_disabled", "Opening explorer is disabled.");
  }

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
    const response = await fetch(upstream, {
      headers: {
        accept: "application/json",
        ...(authorization ? { authorization } : {}),
        ...(validator ? { "if-none-match": validator } : {}),
      },
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)]),
    });
    const responseHeaders = new Headers();
    for (const name of ["cache-control", "content-type", "etag", "server-timing", "vary"]) {
      const value = response.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
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
