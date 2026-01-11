"use client";

import { useEffect } from "react";
import { useAuth } from "../auth/useAuth";
import {
  loadBoardAnnotationColor,
  DEFAULT_BOARD_ANNOTATION_COLOR,
} from "./userPreferencesService";

/**
 * Hook that loads user preferences on app initialization and updates the CSS variable.
 * This should be called once at the app root level.
 *
 * Priority:
 * 1. localStorage (if present, for immediate loading)
 * 2. Firestore (if authenticated and localStorage is empty)
 * 3. Default value
 */
export function useUserPreferences() {
  const { user, status } = useAuth();

  useEffect(() => {
    // Only load preferences once auth status is determined
    if (status === "loading") {
      return;
    }

    const userId = status === "signed_in" && user?.uid ? user.uid : null;

    /**
     * Loads the board annotation color and updates the CSS variable.
     */
    async function loadPreferences() {
      try {
        const color = await loadBoardAnnotationColor(userId);
        const root = document.documentElement;
        root.style.setProperty("--bh-board-annotation-color", color);
      } catch (err) {
        console.error("[useUserPreferences] Failed to load preferences:", err);
        // Fall back to default on error
        const root = document.documentElement;
        root.style.setProperty("--bh-board-annotation-color", DEFAULT_BOARD_ANNOTATION_COLOR);
      }
    }

    void loadPreferences();
  }, [user, status]);
}
