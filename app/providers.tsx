"use client";

import { Toaster } from "react-hot-toast";
import React, { useEffect } from "react";
import { Tooltip } from "react-tooltip";
import { APP_TOOLTIP_ID } from "./utils/tooltips";
import {
  getFirebaseAnalytics,
  initializeFirebaseAppCheck,
} from "./utils/firebaseClient";
import { AuthProvider } from "./auth/AuthProvider";
import { useUserPreferences } from "./utils/useUserPreferences";
import { SharedGameHashesProvider } from "./utils/sharedGameHashesStore";

/**
 * Component that loads user preferences after auth is initialized.
 * Must be rendered inside AuthProvider to access auth context.
 */
function UserPreferencesLoader() {
  useUserPreferences();
  return null;
}

/**
 * Top-level client providers. Currently hosts the toast system so all pages
 * can trigger notifications.
 *
 * Also initializes Firebase Analytics on the client side.
 */
export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize Firebase Analytics on mount
  useEffect(() => {
    try {
      initializeFirebaseAppCheck();
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Firebase App Check initialization failed:", error);
      }
    }

    // Initialize Analytics asynchronously (non-blocking)
    void (async () => {
      try {
        await getFirebaseAnalytics();
        // Analytics is now initialized and ready to use throughout the app
      } catch (error) {
        // Silently fail if Analytics is not configured or not supported
        // This prevents errors from breaking the app if Firebase is not set up
        if (process.env.NODE_ENV === "development") {
          console.warn("Firebase Analytics initialization failed:", error);
        }
      }
    })();
  }, []);

  return (
    <>
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "text-base",
          duration: 4500,
          style: {
            background: "#1f2937",
            color: "#e5e7eb",
            border: "1px solid #374151",
          },
          success: {
            duration: 4000,
            iconTheme: {
              primary: "#34d399",
              secondary: "#0f172a",
            },
          },
          error: {
            duration: 5500,
            iconTheme: {
              primary: "#f87171",
              secondary: "#0f172a",
            },
          },
        }}
      />
      <Tooltip
        id={APP_TOOLTIP_ID}
        place="top"
        offset={10}
        delayShow={150}
        border={"1px solid #374151"}
        style={{
          background: "#111827",
          color: "#f3f4f6",
          borderRadius: 8,
          padding: "6px 8px",
          fontSize: 12,
          lineHeight: "16px",
          maxWidth: 280,
          zIndex: 60,
        }}
      />
      <AuthProvider>
        <UserPreferencesLoader />
        <SharedGameHashesProvider>
          {children}
        </SharedGameHashesProvider>
      </AuthProvider>
    </>
  );
}
