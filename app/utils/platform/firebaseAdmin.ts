import "server-only";

import admin from "firebase-admin";

/**
 * Returns a Firestore instance configured via Firebase Admin SDK.
 *
 * This file is **server-only**; importing it from client components will throw.
 *
 * ## Required environment variables
 *
 * - `FIREBASE_PROJECT_ID`
 * - `FIREBASE_CLIENT_EMAIL`
 * - `FIREBASE_PRIVATE_KEY`
 *
 * Notes:
 * - When storing `FIREBASE_PRIVATE_KEY` in `.env.local`, multiline keys are typically
 *   represented with `\\n`. We normalize those to actual newlines before initializing.
 */
export function getAdminFirestore(): admin.firestore.Firestore {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error(
      "Missing Firebase Admin env vars. Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.",
    );
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  // Ensure we only initialize once across hot reloads / serverless invocations.
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  return admin.firestore();
}
