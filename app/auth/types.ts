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

/**
 * A thin adapter around Firebase Auth that is easy to mock in tests.
 *
 * Why an adapter?
 * - `signInWithPopup()` cannot run in unit tests (and is brittle in component tests).
 * - It keeps Firebase-specific concerns out of UI components.
 */
export interface AuthAdapter {
  /** Subscribe to auth state changes. Returns an unsubscribe function. */
  onAuthStateChanged: (cb: (user: AuthUser | null) => void) => () => void;
  /** Start a Google sign-in flow using a popup. Resolves with the signed-in user. */
  signInWithGooglePopup: () => Promise<AuthUser>;
  /** Sign the current user out. */
  signOut: () => Promise<void>;
}
