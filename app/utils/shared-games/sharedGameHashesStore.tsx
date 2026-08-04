/**
 * @module sharedGameHashesStore
 *
 * React context that caches the current user's shared-game content hashes.
 *
 * Why a client-side cache?
 * - Share flows need O(1) duplicate detection without re-querying Firestore on every click.
 * - After a successful share, {@link SharedGameHashesProvider} can optimistically add the new hash
 *   via {@link SharedGameHashesContextValue.addHash} so the UI stays in sync before the next fetch.
 */
"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/auth/useAuth";
import { getUserSharedGameHashes } from "@/app/utils/shared-games/sharedGamesService";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/** Lifecycle of the hash cache relative to auth and Firestore fetch. */
export type SharedGameHashesStatus = "idle" | "loading" | "loaded" | "error";

/** Values exposed by {@link SharedGameHashesProvider} and {@link useSharedGameHashes}. */
export interface SharedGameHashesContextValue {
  /** Content hashes the user has already shared (for duplicate detection). */
  hashes: Set<string>;
  /** Fetch lifecycle for the hash set. */
  status: SharedGameHashesStatus;
  /** User-facing error when the Firestore read fails. */
  error: string | null;
  /** Re-fetch hashes (e.g. after sign-in or manual refresh). */
  refresh: () => Promise<void>;
  /** Optimistically insert a hash after a successful share without waiting for refresh. */
  addHash: (hash: string) => void;
}

/** Internal React context; consumers must use {@link useSharedGameHashes}. */
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

  /**
   * Fetches hashes from Firestore and transitions status to `loaded` on success.
   * Does not catch errors — callers decide whether to surface them.
   */
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
