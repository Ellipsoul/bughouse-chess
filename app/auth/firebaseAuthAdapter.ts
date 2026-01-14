"use client";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "../utils/firebaseClient";
import type { AuthAdapter, AuthUser } from "./types";

// Re-export for backwards compatibility
export type { AuthAdapter } from "./types";

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
 * Uses `getFirebaseAuth()` from firebaseClient which automatically connects to
 * the Auth emulator when `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` is set.
 *
 * Notes:
 * - This function may throw if Firebase client env vars are missing.
 * - `AuthProvider` catches errors and degrades gracefully to `status="unavailable"`.
 */
export function getFirebaseAuthAdapter(): AuthAdapter {
  if (cachedAdapter) return cachedAdapter;

  const auth = getFirebaseAuth();
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
