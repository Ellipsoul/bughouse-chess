/**
 * Sanitizes a "game id" input value that may be either a raw chess.com game id
 * or a full URL (or any other string containing `/` path segments).
 *
 * Per chess.com examples like `https://www.chess.com/game/live/160407448121`,
 * we extract **everything after the last slash (`/`)**.
 *
 * For bughouse share URLs (e.g. `https://bughouse.aronteh.com/?gameId=...`),
 * we prefer the `gameId` query param.
 *
 * We also defensively strip query/hash fragments and trailing slashes to avoid
 * common copy/paste artifacts like:
 * - `https://www.chess.com/game/live/160407448121?foo=bar`
 * - `https://www.chess.com/game/live/160407448121/`
 */
export function sanitizeChessComGameIdInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  // Prefer explicit share URLs that embed the game id in the query string.
  const queryGameId = extractChessComGameIdFromQuery(trimmed);
  if (queryGameId) return queryGameId;

  // If no query param is present, fall back to extracting the URL tail.
  // Remove `?query` / `#hash` fragments (not part of the game id).
  const withoutQueryOrHash = trimmed.split(/[?#]/, 1)[0] ?? "";
  // Drop any trailing slash to avoid returning an empty segment.
  const withoutTrailingSlashes = withoutQueryOrHash.replace(/\/+$/g, "");

  const lastSlashIdx = withoutTrailingSlashes.lastIndexOf("/");
  if (lastSlashIdx === -1) return withoutTrailingSlashes;
  return withoutTrailingSlashes.slice(lastSlashIdx + 1);
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

/**
 * Extracts the `gameId` query value from a URL-like input, if present.
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
