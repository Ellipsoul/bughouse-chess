/**
 * Session gating for the "game loaded" metric.
 *
 * We want to increment the global counter at most once per browser session per
 * loaded game id. This avoids repeated increments due to:
 * - page refreshes
 * - React remounts
 * - re-loading the same game again in the same tab/session
 *
 * This file is intentionally framework-agnostic and fully unit-testable.
 */

const STORAGE_KEY_PREFIX = "bughouse:metrics:gameLoaded:";

function buildKey(gameId: string): string {
  return `${STORAGE_KEY_PREFIX}${gameId}`;
}

/**
 * Returns whether this browser session has already recorded a game load event
 * for the given game id.
 */
export function hasRecordedGameLoadThisSession(
  storage: Pick<Storage, "getItem">,
  gameId: string,
): boolean {
  if (!gameId) return false;
  return storage.getItem(buildKey(gameId)) === "1";
}

/**
 * Marks that this browser session has recorded a game load event for the given
 * game id.
 */
export function markRecordedGameLoadThisSession(
  storage: Pick<Storage, "setItem">,
  gameId: string,
): void {
  if (!gameId) return;
  storage.setItem(buildKey(gameId), "1");
}
