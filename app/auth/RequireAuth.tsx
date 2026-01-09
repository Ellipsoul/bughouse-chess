"use client";

import React from "react";
import { useAuth } from "./useAuth";

export interface RequireAuthProps {
  children: React.ReactNode;
  /**
   * Optional UI rendered when the user is not authenticated or auth is unavailable.
   */
  fallback?: React.ReactNode;
}

/**
 * Simple auth guard for feature-gating UI.
 *
 * This is intentionally UI-only for now. When we add authenticated server features,
 * we’ll also validate Firebase ID tokens on API routes using `firebase-admin`.
 */
export function RequireAuth({ children, fallback }: RequireAuthProps) {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="p-4 text-gray-300" role="status" aria-live="polite">
        Loading…
      </div>
    );
  }

  if (status !== "signed_in") {
    return (
      fallback ?? (
        <div className="p-4 text-gray-300">
          <p className="text-sm">Please sign in to access this feature.</p>
        </div>
      )
    );
  }

  return <>{children}</>;
}
