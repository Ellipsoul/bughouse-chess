/**
 * User preference for suppressing the "load new game will override" confirmation.
 *
 * Why localStorage?
 * - This preference is UX-only (not security-sensitive) and should persist across sessions.
 * - We intentionally keep this file framework-agnostic and unit-testable by accepting a
 *   `Storage`-like object instead of directly touching `window.localStorage`.
 */
const STORAGE_KEY = "bughouse:ui:skipLoadGameOverrideConfirm";

/**
 * Returns whether the user has opted out of the override warning modal.
 *
 * Storage format:
 * - `"1"` means "skip the warning"
 * - anything else (including missing) means "show the warning"
 */
export function shouldSkipLoadGameOverrideConfirm(storage: Pick<Storage, "getItem">): boolean {
  return storage.getItem(STORAGE_KEY) === "1";
}

/**
 * Persist the preference to skip the override warning modal.
 *
 * Note: We currently only ever write the opt-out state (no UI to re-enable).
 */
export function setSkipLoadGameOverrideConfirm(
  storage: Pick<Storage, "setItem">,
  value: boolean,
): void {
  if (!value) return;
  storage.setItem(STORAGE_KEY, "1");
}


