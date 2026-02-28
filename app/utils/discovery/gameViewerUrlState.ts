/**
 * URL helpers for Game Viewer state synchronization.
 *
 * These helpers centralize query-string behavior so load/navigation handlers can
 * stay focused on state updates and remain easy to test.
 */

/**
 * Distinct contexts where the viewer may decide to synchronize URL state.
 */
export type GameViewerUrlSyncAction = "newGameLoad" | "matchNavigation";

/**
 * Context used to determine whether URL synchronization is allowed.
 */
export interface ShouldSyncGameViewerUrlParams {
  action: GameViewerUrlSyncAction;
  sharedId: string | null;
}

/**
 * Determine whether the viewer should update URL query params for the current action.
 *
 * Rules:
 * - Loading a brand-new game should always update URL state.
 * - Match navigation should update URL state only when not in shared-link mode.
 */
export function shouldSyncGameViewerUrl(params: ShouldSyncGameViewerUrlParams): boolean {
  const { action, sharedId } = params;

  if (action === "newGameLoad") return true;
  if (action === "matchNavigation") return !sharedId;
  return false;
}

/**
 * Parse a 0-based global ply from query params.
 *
 * Returns `null` when:
 * - parameter is missing
 * - value is not an integer
 * - value is negative
 */
export function parsePlyFromSearchParams(searchParams: URLSearchParams): number | null {
  const raw = searchParams.get("ply");
  if (raw === null) return null;

  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

/**
 * Clamp a parsed 0-based global ply to the available mainline bounds.
 *
 * @param ply - Parsed ply from URL (must be a non-negative integer)
 * @param maxPly - Maximum valid ply for the currently loaded game/mainline
 */
export function clampPlyToMainlineBounds(ply: number, maxPly: number): number {
  if (!Number.isFinite(maxPly) || maxPly < 0) return 0;
  return Math.min(Math.max(0, Math.floor(ply)), Math.floor(maxPly));
}

/**
 * Build a canonical Game Viewer URL query string for a game load/navigation action.
 *
 * Canonicalization rules:
 * - always write `gameId` (camelCase)
 * - always remove legacy `gameid`
 * - remove `sharedId` when loading a brand-new game from input
 * - include `ply` only when explicitly provided as a non-negative integer
 */
export function buildGameViewerUrl(params: {
  pathname: string;
  currentSearchParams: URLSearchParams;
  gameId: string;
  ply?: number | null;
  clearSharedId?: boolean;
}): string {
  const { pathname, currentSearchParams, gameId, ply = null, clearSharedId = false } = params;
  const nextParams = new URLSearchParams(currentSearchParams.toString());

  nextParams.set("gameId", gameId);
  nextParams.delete("gameid");
  nextParams.delete("ply");

  if (clearSharedId) {
    nextParams.delete("sharedId");
  }

  if (typeof ply === "number" && Number.isFinite(ply) && ply >= 0) {
    nextParams.set("ply", String(Math.floor(ply)));
  }

  const nextQuery = nextParams.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}
