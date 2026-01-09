"use client";

import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebaseClient";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Result of a username reservation attempt.
 */
export type ReserveUsernameResult =
  | { success: true }
  | { success: false; reason: "username_taken" | "user_already_has_username" | "error"; message: string };

/**
 * Data stored in the `usernames/{username}` document.
 */
export interface UsernameDocument {
  userId: string;
  createdAt: Timestamp;
}

/**
 * Data stored in the `users/{userId}` document.
 */
export interface UserDocument {
  username: string;
  createdAt: Timestamp;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

/** Minimum length for a valid username. */
export const USERNAME_MIN_LENGTH = 3;

/** Maximum length for a valid username. */
export const USERNAME_MAX_LENGTH = 20;

/** Regex pattern for valid usernames: alphanumeric and underscores only. */
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Validates a username string.
 *
 * @param username - The username to validate
 * @returns An error message if invalid, or null if valid
 */
export function validateUsername(username: string): string | null {
  if (username.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters`;
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return `Username must be at most ${USERNAME_MAX_LENGTH} characters`;
  }

  if (!USERNAME_PATTERN.test(username)) {
    return "Username can only contain letters, numbers, and underscores";
  }

  return null;
}

/**
 * Normalizes a username for storage (lowercase).
 *
 * @param username - The username to normalize
 * @returns The normalized username
 */
export function normalizeUsername(username: string): string {
  return username.toLowerCase();
}

/* -------------------------------------------------------------------------- */
/* Firestore Operations                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Checks if a username is available.
 *
 * @param username - The username to check (will be normalized)
 * @returns true if the username is available, false otherwise
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const normalized = normalizeUsername(username);
  const db = getFirestoreDb();
  const docRef = doc(db, "usernames", normalized);
  const docSnap = await getDoc(docRef);
  return !docSnap.exists();
}

/**
 * Gets the username for a user, if they have one.
 *
 * @param userId - The Firebase Auth UID
 * @returns The username if set, or null if not
 */
export async function getUsernameForUser(userId: string): Promise<string | null> {
  const db = getFirestoreDb();
  const docRef = doc(db, "users", userId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data() as UserDocument;
  return data.username ?? null;
}

/**
 * Reserves a username for a user.
 *
 * Uses a Firestore transaction to atomically:
 * 1. Verify the username is still available
 * 2. Verify the user doesn't already have a username
 * 3. Write to both `usernames/{username}` and `users/{userId}`
 *
 * @param userId - The Firebase Auth UID of the user
 * @param username - The desired username (will be normalized)
 * @returns A result object indicating success or failure with reason
 */
export async function reserveUsername(
  userId: string,
  username: string,
): Promise<ReserveUsernameResult> {
  const validationError = validateUsername(username);
  if (validationError) {
    return { success: false, reason: "error", message: validationError };
  }

  const normalized = normalizeUsername(username);
  const db = getFirestoreDb();

  try {
    await runTransaction(db, async (transaction) => {
      const usernameDocRef = doc(db, "usernames", normalized);
      const userDocRef = doc(db, "users", userId);

      // Read both documents first (required by Firestore transactions)
      const [usernameDoc, userDoc] = await Promise.all([
        transaction.get(usernameDocRef),
        transaction.get(userDocRef),
      ]);

      // Check if username is already taken
      if (usernameDoc.exists()) {
        throw new UsernameReservationError("username_taken", "This username is already taken");
      }

      // Check if user already has a username
      if (userDoc.exists() && userDoc.data()?.username) {
        throw new UsernameReservationError(
          "user_already_has_username",
          "You have already set a username",
        );
      }

      // Reserve the username atomically
      const timestamp = serverTimestamp();

      transaction.set(usernameDocRef, {
        userId,
        createdAt: timestamp,
      } satisfies Omit<UsernameDocument, "createdAt"> & { createdAt: ReturnType<typeof serverTimestamp> });

      transaction.set(userDocRef, {
        username: normalized,
        createdAt: timestamp,
      } satisfies Omit<UserDocument, "createdAt"> & { createdAt: ReturnType<typeof serverTimestamp> });
    });

    return { success: true };
  } catch (err) {
    if (err instanceof UsernameReservationError) {
      return { success: false, reason: err.reason, message: err.message };
    }

    // Unexpected error
    const message = err instanceof Error ? err.message : "An unexpected error occurred";
    console.error("[usernameService] reserveUsername failed:", err);
    return { success: false, reason: "error", message };
  }
}

/* -------------------------------------------------------------------------- */
/* Internal Error Class                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Custom error class for username reservation failures.
 * Used internally to propagate specific failure reasons from within a transaction.
 */
class UsernameReservationError extends Error {
  constructor(
    public readonly reason: "username_taken" | "user_already_has_username",
    message: string,
  ) {
    super(message);
    this.name = "UsernameReservationError";
  }
}
