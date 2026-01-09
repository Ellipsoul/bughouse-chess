"use client";

import type { Unsubscribe } from "firebase/auth";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { getFirebaseApp } from "../utils/firebaseClient";
import type { AuthUser } from "./types";

/**
 * A thin adapter around Firebase Auth that is easy to mock in tests.
 *
 * Why an adapter?
 * - `signInWithPopup()` cannot run in unit tests (and is brittle in component tests).
 * - It keeps Firebase-specific concerns out of UI components.
 */
export interface AuthAdapter {
  /** Subscribe to auth state changes. Returns an unsubscribe function. */
  onAuthStateChanged: (cb: (user: AuthUser | null) => void) => Unsubscribe;
  /** Start a Google sign-in flow using a popup. Resolves with the signed-in user. */
  signInWithGooglePopup: () => Promise<AuthUser>;
  /** Sign the current user out. */
  signOut: () => Promise<void>;
}

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

let cachedAdapter: AuthAdapter | null = null;

/**
 * Returns a singleton Firebase auth adapter.
 *
 * Notes:
 * - This function may throw if Firebase client env vars are missing.
 * - `AuthProvider` catches errors and degrades gracefully to `status="unavailable"`.
 */
export function getFirebaseAuthAdapter(): AuthAdapter {
  if (cachedAdapter) return cachedAdapter;

  const app = getFirebaseApp();
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();

  cachedAdapter = {
    onAuthStateChanged: (cb) =>
      onAuthStateChanged(auth, (user) => {
        cb(user ? toAuthUser(user) : null);
      }),
    signInWithGooglePopup: async () => {
      const result = await signInWithPopup(auth, provider);
      return toAuthUser(result.user);
    },
    signOut: async () => {
      await firebaseSignOut(auth);
    },
  };

  return cachedAdapter;
}
