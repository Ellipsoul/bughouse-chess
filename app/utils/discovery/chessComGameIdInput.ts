/**
 * @module chessComGameIdInput
 *
 * Normalizes pasted Chess.com game ids and bughouse share URLs into raw numeric ids.
 */

/** Defensive ceiling so pathological nested paste values cannot recurse forever. */
const MAX_SANITIZE_DEPTH = 5;

/**
 * Sanitizes a "game id" input value that may be either a raw chess.com game id
 * or a full URL (or any other string containing `/` path segments).
 *
 * Per chess.com examples like `https://www.chess.com/game/live/160407448121`,
 * we extract **everything after the last slash (`/`)**.
 *
 * For bughouse share URLs (e.g. `https://bughouse.aronteh.com/?gameId=...`),
 * we prefer the `gameId` query param. That param may itself be a Chess.com URL
 * (or another share URL); we keep resolving until we get a bare id.
 *
 * We also defensively strip query/hash fragments and trailing slashes to avoid
 * common copy/paste artifacts like:
 * - `https://www.chess.com/game/live/160407448121?foo=bar`
 * - `https://www.chess.com/game/live/160407448121/`
 */
export function sanitizeChessComGameIdInput(input: string): string {
  return sanitizeChessComGameIdInputInternal(input, 0);
}

/**
 * Resolves a raw `gameId` / `gameid` query-param value into a canonical Chess.com id.
 *
 * Used by URL auto-load so the effect dedupe key matches the id written back by
 * `syncUrlForLoadedGame`. Without this, `/?gameId=https://www.chess.com/...`
 * keeps the raw URL as the auto-load key while post-load URL sync stores the
 * numeric id — the mismatch re-triggers fetch forever.
 *
 * @returns Canonical id, or `null` when missing/blank after sanitization.
 */
export function resolveChessComGameIdFromQueryParam(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const sanitized = sanitizeChessComGameIdInput(raw);
  return sanitized || null;
}

/**
 * Validates that a game ID matches the expected Chess.com format.
 * Chess.com game IDs are 10, 11, or 12-digit numeric values.
 *
 * @param gameId - The game ID string to validate
 * @returns `true` if the game ID is valid, `false` otherwise
 */
export function isValidChessComGameId(gameId: string): boolean {
  // Chess.com game IDs must be 10, 11, or 12 digits.
  return /^\d{10,12}$/.test(gameId);
}

function sanitizeChessComGameIdInputInternal(input: string, depth: number): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (depth > MAX_SANITIZE_DEPTH) return trimmed;

  // Prefer explicit share URLs that embed the game id in the query string.
  // Recurse because the param value may itself be a Chess.com (or share) URL.
  const queryGameId = extractChessComGameIdFromQuery(trimmed);
  if (queryGameId) {
    return sanitizeChessComGameIdInputInternal(queryGameId, depth + 1);
  }

  return extractIdFromUrlPathTail(trimmed);
}

/**
 * Extracts the trailing path segment from a URL-like string.
 * Strips `?query` / `#hash` and trailing slashes first.
 */
function extractIdFromUrlPathTail(input: string): string {
  const withoutQueryOrHash = input.split(/[?#]/, 1)[0] ?? "";
  const withoutTrailingSlashes = withoutQueryOrHash.replace(/\/+$/g, "");

  const lastSlashIdx = withoutTrailingSlashes.lastIndexOf("/");
  if (lastSlashIdx === -1) return withoutTrailingSlashes;
  return withoutTrailingSlashes.slice(lastSlashIdx + 1);
}

/**
 * Parses a `gameId` / `gameid` query param from pasted bughouse share URLs.
 * Returns null when the input does not look like a query-string share link.
 */
function extractChessComGameIdFromQuery(input: string): string | null {
  if (!/[?&]gameid=/i.test(input)) return null;

  const parsedUrl = (() => {
    try {
      return new URL(input);
    } catch {
      try {
        return new URL(input, "https://bughouse.aronteh.com");
      } catch {
        return null;
      }
    }
  })();

  if (!parsedUrl) return null;

  const gameId = parsedUrl.searchParams.get("gameId") ?? parsedUrl.searchParams.get("gameid");
  if (!gameId) return null;

  const sanitized = gameId.trim();
  return sanitized || null;
}
