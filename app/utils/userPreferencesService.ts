"use client";

import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirestoreDb } from "./firebaseClient";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Default board annotation color (light green).
 * Matches the default value in globals.css.
 */
export const DEFAULT_BOARD_ANNOTATION_COLOR = "rgb(52, 168, 83, 0.95)";

/**
 * LocalStorage key for board annotation color preference.
 */
const LOCAL_STORAGE_KEY = "bh-board-annotation-color";

/**
 * LocalStorage key for auto-advance live replay preference.
 */
const AUTO_ADVANCE_LIVE_REPLAY_KEY = "bh-auto-advance-live-replay";

/**
 * Firestore collection path for user preferences.
 * Structure: users/{userId}/userPreferences/{preferencesDocId}
 */
const USER_PREFERENCES_COLLECTION = "userPreferences";
const USER_PREFERENCES_DOC_ID = "settings";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface UserPreferences {
  boardAnnotationColor: string;
  autoAdvanceLiveReplay: boolean;
}

/* -------------------------------------------------------------------------- */
/* LocalStorage Operations                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Gets the board annotation color from localStorage.
 * Returns the default color if not found or if localStorage is unavailable.
 */
export function getBoardAnnotationColorFromLocalStorage(): string {
  if (typeof window === "undefined") {
    return DEFAULT_BOARD_ANNOTATION_COLOR;
  }

  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      return stored;
    }
  } catch (err) {
    console.warn("[userPreferencesService] Failed to read from localStorage:", err);
  }

  return DEFAULT_BOARD_ANNOTATION_COLOR;
}

/**
 * Saves the board annotation color to localStorage.
 * This is called in real-time as the user selects a color.
 */
export function saveBoardAnnotationColorToLocalStorage(color: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, color);
  } catch (err) {
    console.warn("[userPreferencesService] Failed to write to localStorage:", err);
  }
}

/**
 * Removes the board annotation color from localStorage.
 * Used when reverting to default or canceling changes.
 */
export function removeBoardAnnotationColorFromLocalStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (err) {
    console.warn("[userPreferencesService] Failed to remove from localStorage:", err);
  }
}

/**
 * Gets the auto-advance live replay preference from localStorage.
 * Returns null when no explicit preference is stored.
 */
export function getAutoAdvanceLiveReplayFromLocalStorage(): boolean | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = localStorage.getItem(AUTO_ADVANCE_LIVE_REPLAY_KEY);
    if (stored === null) {
      return null;
    }
    if (stored === "true") {
      return true;
    }
    if (stored === "false") {
      return false;
    }
  } catch (err) {
    console.warn("[userPreferencesService] Failed to read from localStorage:", err);
  }

  return null;
}

/**
 * Saves the auto-advance live replay preference to localStorage.
 */
export function saveAutoAdvanceLiveReplayToLocalStorage(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(AUTO_ADVANCE_LIVE_REPLAY_KEY, String(enabled));
  } catch (err) {
    console.warn("[userPreferencesService] Failed to write to localStorage:", err);
  }
}

/**
 * Removes the auto-advance live replay preference from localStorage.
 */
export function removeAutoAdvanceLiveReplayFromLocalStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(AUTO_ADVANCE_LIVE_REPLAY_KEY);
  } catch (err) {
    console.warn("[userPreferencesService] Failed to remove from localStorage:", err);
  }
}

/* -------------------------------------------------------------------------- */
/* Firestore Operations                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Loads user preferences from Firestore.
 * Returns null if the document doesn't exist or if there's an error.
 */
export async function loadUserPreferencesFromFirestore(
  userId: string,
): Promise<UserPreferences | null> {
  try {
    const db = getFirestoreDb();
    const docRef = doc(db, "users", userId, USER_PREFERENCES_COLLECTION, USER_PREFERENCES_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      boardAnnotationColor: data.boardAnnotationColor ?? DEFAULT_BOARD_ANNOTATION_COLOR,
      autoAdvanceLiveReplay: data.autoAdvanceLiveReplay ?? false,
    };
  } catch (err) {
    console.error("[userPreferencesService] Failed to load preferences from Firestore:", err);
    return null;
  }
}

/**
 * Saves user preferences to Firestore.
 * This is called when the user clicks "Save" in the settings modal.
 */
export async function saveUserPreferencesToFirestore(
  userId: string,
  preferences: UserPreferences,
): Promise<void> {
  try {
    const db = getFirestoreDb();
    const docRef = doc(db, "users", userId, USER_PREFERENCES_COLLECTION, USER_PREFERENCES_DOC_ID);
    await setDoc(docRef, preferences, { merge: true });
  } catch (err) {
    console.error("[userPreferencesService] Failed to save preferences to Firestore:", err);
    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/* Unified Preference Loading                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Loads the board annotation color preference using the following priority:
 * 1. localStorage (if present, for immediate loading)
 * 2. Firestore (if authenticated and localStorage is empty)
 * 3. Default value
 *
 * This function should be called on app initialization.
 */
export async function loadBoardAnnotationColor(
  userId: string | null,
): Promise<string> {
  // First, check localStorage for immediate loading
  const localColor = getBoardAnnotationColorFromLocalStorage();
  if (localColor !== DEFAULT_BOARD_ANNOTATION_COLOR) {
    return localColor;
  }

  // If authenticated and no localStorage value, check Firestore
  if (userId) {
    const firestorePrefs = await loadUserPreferencesFromFirestore(userId);
    if (firestorePrefs?.boardAnnotationColor) {
      // Sync to localStorage for future loads
      saveBoardAnnotationColorToLocalStorage(firestorePrefs.boardAnnotationColor);
      return firestorePrefs.boardAnnotationColor;
    }
  }

  return DEFAULT_BOARD_ANNOTATION_COLOR;
}

/**
 * Loads the auto-advance live replay preference using the following priority:
 * 1. localStorage (if present)
 * 2. Firestore (if authenticated and localStorage is empty)
 * 3. Default value (false)
 */
export async function loadAutoAdvanceLiveReplayPreference(
  userId: string | null,
): Promise<boolean> {
  // First, check localStorage for an explicit preference
  const localPreference = getAutoAdvanceLiveReplayFromLocalStorage();
  if (localPreference !== null) {
    return localPreference;
  }

  // If authenticated and no localStorage value, check Firestore
  if (userId) {
    const firestorePrefs = await loadUserPreferencesFromFirestore(userId);
    if (typeof firestorePrefs?.autoAdvanceLiveReplay === "boolean") {
      // Sync to localStorage for future loads
      saveAutoAdvanceLiveReplayToLocalStorage(firestorePrefs.autoAdvanceLiveReplay);
      return firestorePrefs.autoAdvanceLiveReplay;
    }
  }

  return false;
}
