"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { getUserSharedGameHashes } from "./sharedGamesService";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type SharedGameHashesStatus = "idle" | "loading" | "loaded" | "error";

export interface SharedGameHashesContextValue {
  hashes: Set<string>;
  status: SharedGameHashesStatus;
  error: string | null;
  refresh: () => Promise<void>;
  addHash: (hash: string) => void;
}

const SharedGameHashesContext = createContext<SharedGameHashesContextValue | null>(null);

/* -------------------------------------------------------------------------- */
/* Provider                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Loads and stores the current user's shared game hashes for deduplication checks.
 */
export function SharedGameHashesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [hashes, setHashes] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<SharedGameHashesStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const loadHashes = useCallback(async (userId: string) => {
    setStatus("loading");
    setError(null);

    const list = await getUserSharedGameHashes(userId);
    setHashes(new Set(list));
    setStatus("loaded");
  }, []);

  const refresh = useCallback(async () => {
    const userId = user?.uid ?? null;
    if (!userId) {
      setHashes(new Set());
      setStatus("idle");
      setError(null);
      return;
    }

    try {
      await loadHashes(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load shared game hashes";
      setStatus("error");
      setError(message);
    }
  }, [loadHashes, user]);

  useEffect(() => {
    let isActive = true;
    const userId = user?.uid ?? null;

    if (!userId) {
      queueMicrotask(() => {
        if (!isActive) return;
        setHashes(new Set());
        setStatus("idle");
        setError(null);
      });
      return () => {
        isActive = false;
      };
    }

    void (async () => {
      try {
        await loadHashes(userId);
      } catch (err) {
        if (!isActive) return;
        const message = err instanceof Error ? err.message : "Failed to load shared game hashes";
        setStatus("error");
        setError(message);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [loadHashes, user]);

  const addHash = useCallback((hash: string) => {
    setHashes((prev) => {
      const next = new Set(prev);
      next.add(hash);
      return next;
    });
  }, []);

  const value = useMemo<SharedGameHashesContextValue>(
    () => ({
      hashes,
      status,
      error,
      refresh,
      addHash,
    }),
    [hashes, status, error, refresh, addHash],
  );

  return (
    <SharedGameHashesContext.Provider value={value}>
      {children}
    </SharedGameHashesContext.Provider>
  );
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Access the current user's shared game hashes.
 *
 * @throws if used outside SharedGameHashesProvider.
 */
export function useSharedGameHashes(): SharedGameHashesContextValue {
  const ctx = useContext(SharedGameHashesContext);
  if (!ctx) {
    throw new Error("useSharedGameHashes must be used within <SharedGameHashesProvider>");
  }
  return ctx;
}
