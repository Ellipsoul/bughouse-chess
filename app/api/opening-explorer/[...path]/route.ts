import { openingExplorerEnabled } from "@/app/components/opening-explorer/featureFlag";

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

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

function localServiceOrigin(): URL {
  const origin = new URL(process.env.OPENING_EXPLORER_SERVICE_URL ?? "http://127.0.0.1:8765");
  if (origin.protocol !== "http:" || !LOOPBACK_HOSTS.has(origin.hostname) || origin.username || origin.password) {
    throw new Error("Opening explorer service URL must be an unauthenticated loopback HTTP origin.");
  }
  return origin;
}

function jsonError(status: number, code: string, detail: string): Response {
  return Response.json({ code, detail }, { status });
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  if (!openingExplorerEnabled({
    nodeEnv: process.env.NODE_ENV,
    publicFlag: process.env.NEXT_PUBLIC_ENABLE_OPENING_EXPLORER,
  })) {
    return jsonError(404, "feature_disabled", "Opening explorer is disabled.");
  }

  const { path } = await context.params;
  if (!isAllowedReadPath(path)) {
    return jsonError(404, "invalid_proxy_path", "Unknown opening explorer operation.");
  }

  let upstream: URL;
  try {
    upstream = new URL(`/${path.join("/")}`, localServiceOrigin());
  } catch {
    return jsonError(503, "service_unavailable", "The local opening service is unavailable.");
  }
  upstream.search = new URL(request.url).search;

  try {
    const response = await fetch(upstream, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: request.signal,
    });
    return new Response(response.body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return jsonError(503, "service_unavailable", "The local opening service is unavailable.");
  }
}
