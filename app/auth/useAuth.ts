"use client";

import { useContext } from "react";
import { AuthContext } from "./AuthProvider";

/**
 * Access the global auth state and actions.
 *
 * @throws if called outside `AuthProvider`.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
