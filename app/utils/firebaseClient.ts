"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import {
  getAuth as firebaseGetAuth,
  connectAuthEmulator,
  type Auth,
} from "firebase/auth";
import {
  getFirestore as firestoreGetFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";

/**
 * Firebase client configuration.
 *
 * This file is **client-only**; importing it from server components will throw.
 *
 * ## Required environment variables
 *
 * All variables must be prefixed with `NEXT_PUBLIC_` to be accessible in the browser:
 *
 * - `NEXT_PUBLIC_FIREBASE_API_KEY`
 * - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
 * - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
 * - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
 * - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
 * - `NEXT_PUBLIC_FIREBASE_APP_ID`
 * - `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (required for Analytics)
 *
 * These values can be found in your Firebase Console under Project Settings > General > Your apps.
 * The `measurementId` is created automatically when you enable Analytics for your web app.
 */
function getFirebaseConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    throw new Error(
      "Missing Firebase client env vars. Required: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, NEXT_PUBLIC_FIREBASE_APP_ID.",
    );
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    measurementId, // Optional but required for Analytics
  };
}

/**
 * Initializes Firebase app instance (singleton pattern).
 * Returns the existing app if already initialized.
 */
export function getFirebaseApp(): FirebaseApp {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0]!;
  }

  const config = getFirebaseConfig();
  return initializeApp(config);
}

/**
 * Gets or initializes Firebase Analytics instance.
 *
 * Returns `null` if Analytics is not supported (e.g., in SSR, or if measurementId is missing).
 * Firebase Analytics requires browser environment and a valid measurementId.
 *
 * Note: Firebase Analytics has built-in throttling to prevent excessive event logging,
 * so manual throttling is not necessary.
 */
export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  // Analytics only works in browser environment
  if (typeof window === "undefined") {
    return null;
  }

  // Check if Analytics is supported in this environment
  const supported = await isSupported();
  if (!supported) {
    return null;
  }

  const app = getFirebaseApp();
  return getAnalytics(app);
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

/** Tracks whether the Auth emulator has been connected to avoid duplicate connections. */
let authEmulatorConnected = false;

/** Cached Auth instance (singleton). */
let cachedAuth: Auth | null = null;

/**
 * Gets or initializes Firebase Auth instance (singleton pattern).
 *
 * Automatically connects to the Auth emulator if the
 * `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` environment variable is set.
 *
 * @example
 * ```ts
 * const auth = getFirebaseAuth();
 * onAuthStateChanged(auth, (user) => { ... });
 * ```
 */
export function getFirebaseAuth(): Auth {
  if (cachedAuth) {
    return cachedAuth;
  }

  const app = getFirebaseApp();
  const auth = firebaseGetAuth(app);

  // Connect to emulator if configured (only once)
  const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (emulatorHost && !authEmulatorConnected) {
    // Auth emulator requires the full URL with http:// prefix
    connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
    authEmulatorConnected = true;
    console.info(`[Firebase] Connected to Auth emulator at ${emulatorHost}`);
  }

  cachedAuth = auth;
  return auth;
}

/* -------------------------------------------------------------------------- */
/* Firestore                                                                  */
/* -------------------------------------------------------------------------- */

/** Tracks whether the Firestore emulator has been connected to avoid duplicate connections. */
let firestoreEmulatorConnected = false;

/** Cached Firestore instance (singleton). */
let cachedFirestore: Firestore | null = null;

/**
 * Gets or initializes Firestore instance (singleton pattern).
 *
 * Automatically connects to the Firestore emulator if the
 * `NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST` environment variable is set.
 *
 * @example
 * ```ts
 * const db = getFirestoreDb();
 * const docRef = doc(db, "users", userId);
 * ```
 */
export function getFirestoreDb(): Firestore {
  if (cachedFirestore) {
    return cachedFirestore;
  }

  const app = getFirebaseApp();
  const db = firestoreGetFirestore(app);

  // Connect to emulator if configured (only once)
  const emulatorHost = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST;
  if (emulatorHost && !firestoreEmulatorConnected) {
    const [host, portStr] = emulatorHost.split(":");
    const port = parseInt(portStr ?? "8080", 10);
    connectFirestoreEmulator(db, host ?? "127.0.0.1", port);
    firestoreEmulatorConnected = true;
    console.info(`[Firebase] Connected to Firestore emulator at ${host}:${port}`);
  }

  cachedFirestore = db;
  return db;
}
