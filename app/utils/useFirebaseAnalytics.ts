"use client";

import { useEffect, useRef, useState } from "react";
import { getFirebaseAnalytics } from "./firebaseClient";
import { logEvent, type Analytics } from "firebase/analytics";

/**
 * React hook that provides access to Firebase Analytics.
 *
 * Returns `null` if Analytics is not available (e.g., SSR, unsupported environment, or missing config).
 * The analytics instance is initialized asynchronously on the client side.
 *
 * @example
 * ```tsx
 * const analytics = useFirebaseAnalytics();
 * if (analytics) {
 *   logEvent(analytics, 'button_click', { button_name: 'load_game' });
 * }
 * ```
 */
export function useFirebaseAnalytics(): Analytics | null {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple initialization attempts
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    // Initialize Analytics asynchronously
    void (async () => {
      try {
        const instance = await getFirebaseAnalytics();
        setAnalytics(instance);
      } catch (error) {
        // Silently fail in development or if Analytics is not configured
        // This prevents errors from breaking the app if Firebase is not set up
        if (process.env.NODE_ENV === "development") {
          console.warn("Firebase Analytics not available:", error);
        }
      }
    })();
  }, []);

  return analytics;
}

/**
 * Helper function to log an analytics event safely.
 * Returns `true` if the event was logged, `false` if Analytics is not available.
 *
 * @param analytics - Analytics instance from `useFirebaseAnalytics()`
 * @param eventName - Name of the event to log
 * @param eventParams - Optional event parameters
 *
 * @example
 * ```tsx
 * const analytics = useFirebaseAnalytics();
 * const handleClick = () => {
 *   logAnalyticsEvent(analytics, 'load_game_button_click');
 *   // ... rest of handler
 * };
 * ```
 */
export function logAnalyticsEvent(
  analytics: Analytics | null,
  eventName: string,
  eventParams?: Record<string, string | number | boolean>,
): boolean {
  if (!analytics) {
    return false;
  }

  try {
    logEvent(analytics, eventName, eventParams);
    return true;
  } catch (error) {
    // Silently fail to prevent analytics errors from breaking the app
    if (process.env.NODE_ENV === "development") {
      console.warn("Failed to log analytics event:", error);
    }
    return false;
  }
}
