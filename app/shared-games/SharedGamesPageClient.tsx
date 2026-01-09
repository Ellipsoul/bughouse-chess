"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { useCompactLandscape } from "../utils/useCompactLandscape";
import { getSharedGames } from "../utils/sharedGamesService";
import type { SharedGame, SharedGamesPage as SharedGamesPageData } from "../types/sharedGame";
import { SHARED_GAMES_DEFAULT_PAGE_SIZE } from "../types/sharedGame";
import SharedGameCard from "../components/SharedGameCard";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type LoadingState = "idle" | "loading" | "error";

/* -------------------------------------------------------------------------- */
/* Helper Components                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Loading skeleton for the shared games grid.
 */
function LoadingSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-48 rounded-xl border border-gray-700/50 bg-gray-800/40 animate-pulse"
        />
      ))}
    </div>
  );
}

/**
 * Empty state when no games are shared.
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-6xl">🏆</div>
      <h2 className="mb-2 text-xl font-semibold text-gray-100">
        No shared games yet
      </h2>
      <p className="max-w-md text-gray-400">
        Be the first to share a game! Load a bughouse game in the viewer and click
        the share button to share it with everyone.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-mariner-600 px-4 py-2 text-sm font-medium text-white hover:bg-mariner-500 transition-colors"
      >
        Go to Viewer
      </Link>
    </div>
  );
}

/**
 * Error state when loading fails.
 */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-6xl">😵</div>
      <h2 className="mb-2 text-xl font-semibold text-gray-100">
        Failed to load shared games
      </h2>
      <p className="mb-6 max-w-md text-gray-400">
        Something went wrong while loading the shared games. Please try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-md bg-mariner-600 px-4 py-2 text-sm font-medium text-white hover:bg-mariner-500 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

/**
 * Pagination controls.
 */
function PaginationControls({
  currentPage,
  hasMore,
  isLoading,
  onPrevious,
  onNext,
}: {
  currentPage: number;
  hasMore: boolean;
  isLoading: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const canGoPrevious = currentPage > 1;
  const canGoNext = hasMore;

  return (
    <div className="flex items-center justify-center gap-4 py-6">
      <button
        type="button"
        onClick={onPrevious}
        disabled={!canGoPrevious || isLoading}
        className={[
          "inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
          canGoPrevious && !isLoading
            ? "border-gray-600 bg-gray-800 text-gray-100 hover:bg-gray-700"
            : "border-gray-700 bg-gray-800/50 text-gray-500 cursor-not-allowed",
        ].join(" ")}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Previous
      </button>

      <span className="text-sm text-gray-400">
        Page {currentPage}
      </span>

      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext || isLoading}
        className={[
          "inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
          canGoNext && !isLoading
            ? "border-gray-600 bg-gray-800 text-gray-100 hover:bg-gray-700"
            : "border-gray-700 bg-gray-800/50 text-gray-500 cursor-not-allowed",
        ].join(" ")}
        aria-label="Next page"
      >
        Next
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Client-side shared games browsing page.
 * Displays a paginated grid of shared games from all users.
 */
export default function SharedGamesPageClient() {
  const { user } = useAuth();
  const isCompactLandscape = useCompactLandscape();

  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [games, setGames] = useState<SharedGame[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [cursors, setCursors] = useState<(Date | null)[]>([null]); // Index 0 = page 1 cursor (null for first page)

  /**
   * Loads shared games for a specific page.
   */
  const loadPage = useCallback(async (page: number, cursor: Date | null) => {
    setLoadingState("loading");

    try {
      const result: SharedGamesPageData = await getSharedGames({
        pageSize: SHARED_GAMES_DEFAULT_PAGE_SIZE,
        startAfter: cursor ?? undefined,
      });

      setGames(result.games);
      setHasMore(result.hasMore);
      setCurrentPage(page);

      // Store cursor for next page if it exists
      if (result.nextCursor && page === cursors.length) {
        setCursors((prev) => [...prev, result.nextCursor]);
      }

      setLoadingState("idle");
    } catch (err) {
      console.error("[SharedGamesPageClient] Failed to load games:", err);
      setLoadingState("error");
    }
  }, [cursors.length]);

  /**
   * Initial load on mount.
   * Shared games are publicly readable, so we don't need to wait for auth.
   */
  useEffect(() => {
    void loadPage(1, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Handles going to the previous page.
   */
  const handlePrevious = useCallback(() => {
    if (currentPage <= 1) return;
    const prevPage = currentPage - 1;
    const prevCursor = cursors[prevPage - 1] ?? null;
    void loadPage(prevPage, prevCursor);
  }, [currentPage, cursors, loadPage]);

  /**
   * Handles going to the next page.
   */
  const handleNext = useCallback(() => {
    if (!hasMore) return;
    const nextPage = currentPage + 1;
    const nextCursor = cursors[currentPage] ?? null;
    void loadPage(nextPage, nextCursor);
  }, [currentPage, hasMore, cursors, loadPage]);

  /**
   * Handles retry after error.
   */
  const handleRetry = useCallback(() => {
    const cursor = cursors[currentPage - 1] ?? null;
    void loadPage(currentPage, cursor);
  }, [currentPage, cursors, loadPage]);

  /**
   * Handles game deletion - removes from local state.
   */
  const handleGameDeleted = useCallback((deletedId: string) => {
    setGames((prev) => prev.filter((g) => g.id !== deletedId));
  }, []);

  const isLoading = loadingState === "loading";
  const isError = loadingState === "error";
  const isEmpty = !isLoading && !isError && games.length === 0;

  return (
    <div className="h-full w-full bg-gray-900 flex flex-col overflow-hidden">
      {/* Fixed header */}
      <header
        className={[
          "fixed top-0 left-0 right-0 z-50 bg-gray-800 border-b border-gray-700 shadow-md",
          isCompactLandscape ? "py-0" : "py-3",
        ].join(" ")}
      >
        <div className="mx-auto flex w-full max-w-[1600px] items-center min-h-10 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to viewer
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main
        className={[
          "flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-6",
          isCompactLandscape ? "pt-16" : "pt-[76px]",
        ].join(" ")}
      >
        <div className="mx-auto max-w-[1400px]">
          {/* Page title */}
          <div className="mb-6 pt-4">
            <h1 className="text-2xl font-bold text-gray-100">Shared Games</h1>
            <p className="mt-1 text-gray-400">
              Browse games and matches shared by the community
            </p>
          </div>

          {/* Content */}
          {isLoading && games.length === 0 && <LoadingSkeleton />}

          {isError && <ErrorState onRetry={handleRetry} />}

          {isEmpty && <EmptyState />}

          {!isError && games.length > 0 && (
            <>
              {/* Loading overlay for page transitions */}
              {isLoading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-mariner-400" />
                </div>
              )}

              {/* Games grid */}
              <div
                className={[
                  "grid gap-4",
                  "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
                  isLoading ? "opacity-50 pointer-events-none" : "",
                ].join(" ")}
              >
                {games.map((game) => (
                  <SharedGameCard
                    key={game.id}
                    game={game}
                    currentUserId={user?.uid ?? null}
                    onDeleted={handleGameDeleted}
                  />
                ))}
              </div>

              {/* Pagination */}
              <PaginationControls
                currentPage={currentPage}
                hasMore={hasMore}
                isLoading={isLoading}
                onPrevious={handlePrevious}
                onNext={handleNext}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
