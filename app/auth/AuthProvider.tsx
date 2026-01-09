"use client";

import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { getFirebaseAuthAdapter, type AuthAdapter } from "./firebaseAuthAdapter";
import type { AuthStatus, AuthUser } from "./types";

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  /**
   * A human-friendly error message intended for UI (not logs).
   * Present only when `status === "unavailable"`.
   */
  errorMessage?: string;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
  /**
   * Optional adapter injection to make tests deterministic and avoid Firebase popup behavior.
   */
  adapter?: AuthAdapter;
}

/**
 * Attempt to get the Firebase auth adapter, returning null and an error message if unavailable.
 * This is evaluated once during component initialization (not in useMemo to avoid setState issues).
 */
function tryGetAdapter(injectedAdapter?: AuthAdapter): {
  adapter: AuthAdapter | null;
  error: string | null;
} {
  if (injectedAdapter) return { adapter: injectedAdapter, error: null };
  try {
    return { adapter: getFirebaseAuthAdapter(), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Firebase Auth is not available";
    return { adapter: null, error: message };
  }
}

/**
 * Global authentication provider.
 *
 * Responsibilities:
 * - Keep `user` and `status` in sync with Firebase auth state.
 * - Expose sign-in/sign-out actions to the rest of the app.
 * - Fail safe if Firebase is not configured: the app continues to work in anonymous mode.
 */
export function AuthProvider({ children, adapter }: AuthProviderProps) {
  // Initialize adapter state lazily to avoid calling setState in useMemo.
  // The adapter is a singleton so this only needs to run once.
  const [adapterState] = useState(() => tryGetAdapter(adapter));
  const resolvedAdapter = adapterState.adapter;
  const initError = adapterState.error;

  const [status, setStatus] = useState<AuthStatus>(() =>
    initError ? "unavailable" : "loading"
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(initError ?? undefined);

  useEffect(() => {
    if (!resolvedAdapter) return;

    let unsub: (() => void) | undefined;
    let didError = false;

    try {
      unsub = resolvedAdapter.onAuthStateChanged((nextUser) => {
        setUser(nextUser);
        setStatus(nextUser ? "signed_in" : "signed_out");
        setErrorMessage(undefined);
      });
    } catch (err) {
      // Handle adapters that throw during subscription (e.g. missing configuration).
      // We defer the setState to avoid synchronous updates within an effect body.
      didError = true;
      const message = err instanceof Error ? err.message : "Auth subscription failed";
      console.error("AuthProvider: failed to subscribe to auth state", err);

      // Use queueMicrotask to defer state updates (avoids eslint react-hooks/set-state-in-effect)
      queueMicrotask(() => {
        setStatus("unavailable");
        setErrorMessage(message);
      });
    }

    return () => {
      if (!didError) unsub?.();
    };
  }, [resolvedAdapter]);

  const signInWithGoogle = useCallback(async () => {
    if (!resolvedAdapter) return;
    await resolvedAdapter.signInWithGooglePopup();
    // Auth state is updated via the onAuthStateChanged subscription.
  }, [resolvedAdapter]);

  const signOut = useCallback(async () => {
    if (!resolvedAdapter) return;
    await resolvedAdapter.signOut();
    // Auth state is updated via the onAuthStateChanged subscription.
  }, [resolvedAdapter]);

  const value: AuthContextValue = useMemo(
    () => ({
      status,
      user,
      errorMessage,
      signInWithGoogle,
      signOut,
    }),
    [status, user, errorMessage, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
