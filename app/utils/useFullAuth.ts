"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "../auth/useAuth";
import { getUsernameForUser } from "./usernameService";
import type { AuthUser } from "../auth/types";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Full authentication status including username reservation.
 *
 * - `loading`: Initial state while determining auth status
 * - `not_signed_in`: User is not signed in
 * - `no_username`: User is signed in but hasn't reserved a username
 * - `fully_authenticated`: User is signed in AND has a reserved username
 */
export type FullAuthStatus =
  | "loading"
  | "not_signed_in"
  | "no_username"
  | "fully_authenticated";

/**
 * Return type of the useFullAuth hook.
 */
export interface FullAuthState {
  /**
   * Current full authentication status.
   */
  status: FullAuthStatus;

  /**
   * The authenticated user, or null if not signed in.
   */
  user: AuthUser | null;

  /**
   * The user's reserved username, or null if not set.
   */
  username: string | null;

  /**
   * Whether the user is fully authenticated (signed in + has username).
   * Convenience boolean for conditional rendering.
   */
  isFullyAuthenticated: boolean;
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Hook that combines Firebase Auth state with username reservation status.
 *
 * This is used to gate features that require "full authentication" -
 * meaning the user must be both signed in AND have reserved a username.
 *
 * @example
 * ```tsx
 * function ShareButton() {
 *   const { status, isFullyAuthenticated, username } = useFullAuth();
 *
 *   if (!isFullyAuthenticated) {
 *     return <button disabled>Sign in and set username to share</button>;
 *   }
 *
 *   return <button onClick={handleShare}>Share Game</button>;
 * }
 * ```
 */
export function useFullAuth(): FullAuthState {
  const { status: authStatus, user } = useAuth();

  // Username state: { status, value } combined to allow atomic updates
  type UsernameState =
    | { status: "idle" }
    | { status: "loading"; forUserId: string }
    | { status: "loaded"; forUserId: string; value: string | null };

  const [usernameState, setUsernameState] = useState<UsernameState>({ status: "idle" });

  // Track the user ID we're currently loading for to detect stale responses
  const loadingForUserIdRef = useRef<string | null>(null);

  // Fetch username when user signs in
  useEffect(() => {
    // No user - reset to idle (via callback to avoid sync setState)
    if (!user) {
      loadingForUserIdRef.current = null;
      return;
    }

    // If we already have loaded data for this exact user, skip
    if (
      usernameState.status === "loaded" &&
      usernameState.forUserId === user.uid
    ) {
      return;
    }

    // If we're already loading for this user, skip
    if (
      usernameState.status === "loading" &&
      usernameState.forUserId === user.uid
    ) {
      return;
    }

    // Start loading for this user
    const userId = user.uid;
    loadingForUserIdRef.current = userId;

    // Set loading state via microtask to avoid synchronous setState
    queueMicrotask(() => {
      if (loadingForUserIdRef.current === userId) {
        setUsernameState({ status: "loading", forUserId: userId });
      }
    });

    getUsernameForUser(userId)
      .then((fetchedUsername) => {
        // Only update if this is still the user we're loading for
        if (loadingForUserIdRef.current === userId) {
          setUsernameState({
            status: "loaded",
            forUserId: userId,
            value: fetchedUsername,
          });
        }
      })
      .catch((err) => {
        // Username not found is expected for new users
        console.debug("[useFullAuth] No username found for user:", err);
        if (loadingForUserIdRef.current === userId) {
          setUsernameState({
            status: "loaded",
            forUserId: userId,
            value: null,
          });
        }
      });
  }, [user, usernameState]);

  // Derive username from state
  const username = useMemo(() => {
    if (usernameState.status === "loaded" && user && usernameState.forUserId === user.uid) {
      return usernameState.value;
    }
    return null;
  }, [usernameState, user]);

  // Derive loading state from state
  const isLoadingUsername = usernameState.status === "loading";

  // Compute the full auth status
  const status: FullAuthStatus = useMemo(() => {
    // Still loading base auth state
    if (authStatus === "loading") {
      return "loading";
    }

    // Auth is unavailable or user is signed out
    if (authStatus === "unavailable" || authStatus === "signed_out" || !user) {
      return "not_signed_in";
    }

    // User is signed in but we're still checking for username
    if (isLoadingUsername) {
      return "loading";
    }

    // User is signed in but doesn't have a username
    if (!username) {
      return "no_username";
    }

    // User is fully authenticated
    return "fully_authenticated";
  }, [authStatus, user, isLoadingUsername, username]);

  const isFullyAuthenticated = status === "fully_authenticated";

  return {
    status,
    user,
    username,
    isFullyAuthenticated,
  };
}

/**
 * Returns a human-readable message explaining why the user cannot perform
 * an action that requires full authentication.
 *
 * @param status - The current full auth status
 * @returns A user-friendly message, or null if fully authenticated
 */
export function getFullAuthRequirementMessage(status: FullAuthStatus): string | null {
  switch (status) {
    case "loading":
      return "Checking authentication...";
    case "not_signed_in":
      return "Sign in to share games";
    case "no_username":
      return "Set a username in your profile to share games";
    case "fully_authenticated":
      return null;
  }
}
