export type AuthStatus = "loading" | "signed_out" | "signed_in" | "unavailable";

/**
 * Minimal user identity details required by the app UI.
 *
 * We intentionally keep this small and stable so it can be:
 * - mocked easily in tests
 * - swapped to a different auth provider later if needed
 */
export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};
