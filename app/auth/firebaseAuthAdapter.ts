"use client";

import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { getFirebaseApp } from "../utils/firebaseClient";
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
