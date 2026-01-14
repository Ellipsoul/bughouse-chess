"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Funnel } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { useCompactLandscape } from "../utils/useCompactLandscape";
import { useFullAuth } from "../utils/useFullAuth";
import type { SharedGameSummary } from "../types/sharedGame";
import { filterSharedGames } from "../utils/sharedGamesFilter";
import SharedGameCard from "../components/shared/SharedGameCard";
import { useFirebaseAnalytics, logAnalyticsEvent } from "../utils/useFirebaseAnalytics";
import { useEffect } from "react";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface SharedGamesPageClientProps {
  /**
   * All shared games to display and filter.
   */
  games: SharedGameSummary[];
}

/* -------------------------------------------------------------------------- */
/* Helper Components                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Empty state when no games match the filters.
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-6xl">🔍</div>
      <h2 className="mb-2 text-xl font-semibold text-gray-100">
        No games match your filters
      </h2>
      <p className="max-w-md text-gray-400">
        Try adjusting your filter criteria to see more results.
      </p>
    </div>
  );
}

/**
 * Empty state when no games are shared at all.
 */
function NoGamesState() {
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

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Client-side shared games browsing page.
 * Displays a filterable grid of shared games from all users.
 */
export default function SharedGamesPageClient({
  games: allGames,
}: SharedGamesPageClientProps) {
  const { user } = useAuth();
  const { isFullyAuthenticated, status: fullAuthStatus } = useFullAuth();
  const isCompactLandscape = useCompactLandscape();
  const analytics = useFirebaseAnalytics();

  // Log analytics when shared games page is viewed
  useEffect(() => {
    logAnalyticsEvent(analytics, "shared_games_page_viewed", {
      total_games: allGames.length,
      user_authenticated: user ? "true" : "false",
    });
  }, [analytics, allGames.length, user]);

  // Track deleted game IDs to remove them from display immediately
  const [deletedGameIds, setDeletedGameIds] = useState<Set<string>>(new Set());

  // Filter state
  const [filterPlayer1, setFilterPlayer1] = useState("");
  const [filterPlayer2, setFilterPlayer2] = useState("");
  const [filterPlayer3, setFilterPlayer3] = useState("");
  const [filterPlayer4, setFilterPlayer4] = useState("");
  const [filterSharer, setFilterSharer] = useState("");
  const [includeGame, setIncludeGame] = useState(true);
  const [includeMatch, setIncludeMatch] = useState(true);
  const [includePartnerGames, setIncludePartnerGames] = useState(true);

  // Filter out deleted games from the games list
  const availableGames = useMemo(() => {
    return allGames.filter((game) => !deletedGameIds.has(game.id));
  }, [allGames, deletedGameIds]);

  /**
   * Filters games based on the current filter inputs.
   * Uses the shared games filter utility which handles interchangeable positions.
   */
  const filteredGames = useMemo(() => {
    return filterSharedGames(availableGames, {
      player1: filterPlayer1,
      player2: filterPlayer2,
      player3: filterPlayer3,
      player4: filterPlayer4,
      sharer: filterSharer,
      includeGame,
      includeMatch,
      includePartnerGames,
    });
  }, [
    availableGames,
    filterPlayer1,
    filterPlayer2,
    filterPlayer3,
    filterPlayer4,
    filterSharer,
    includeGame,
    includeMatch,
    includePartnerGames,
  ]);

  /**
   * Handles game deletion - removes from local display immediately.
   * The deletion will be reflected on next page load due to cache revalidation.
   */
  const handleGameDeleted = useCallback((deletedId: string) => {
    setDeletedGameIds((prev) => new Set(prev).add(deletedId));
  }, []);

  const isEmpty = availableGames.length === 0;
  const hasFilteredResults = filteredGames.length > 0;

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
          {/* Page title and filters in same row */}
          <div className="mb-6 pt-4 flex flex-col sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="mb-4 sm:mb-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-100">
                Shared Games
              </h1>
              <p className="mt-1 text-gray-400 hidden sm:block">
                Browse games and matches shared by the community
              </p>
              {fullAuthStatus !== "loading" && !isFullyAuthenticated && (
                <p className="mt-2 text-sm text-gray-400 hidden sm:block">
                  <Link
                    href="/profile"
                    className="text-mariner-400 hover:text-mariner-300 underline transition-colors"
                  >
                    Sign in and set your username to share games!
                  </Link>
                </p>
              )}
            </div>

            {/* Compact filter section */}
            <div className="shrink-0 rounded-md border border-gray-700/50 bg-gray-800/60 p-2 sm:p-2.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Funnel className="h-3 w-3 text-gray-400" aria-hidden="true" />
                <h2 className="text-xs font-medium text-gray-300">Filter</h2>
              </div>

              <div className="space-y-1.5">
                {/* Sharer filter */}
                <div>
                  <input
                    id="filter-sharer"
                    type="text"
                    value={filterSharer}
                    onChange={(e) => setFilterSharer(e.target.value)}
                    placeholder="Sharer"
                    className="w-full rounded border border-gray-600 bg-gray-800/80 px-2 py-1 text-xs text-gray-100 placeholder-gray-500 focus:border-mariner-500 focus:outline-none focus:ring-1 focus:ring-mariner-500"
                  />
                </div>

                {/* Player filters in compact grid */}
                <div className="space-y-1">
                  {/* Team 1 */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      id="filter-player1"
                      type="text"
                      value={filterPlayer1}
                      onChange={(e) => setFilterPlayer1(e.target.value)}
                      placeholder="Player 1"
                      className="rounded border border-gray-600 bg-gray-800/80 px-2 py-1 text-xs text-gray-100 placeholder-gray-500 focus:border-mariner-500 focus:outline-none focus:ring-1 focus:ring-mariner-500"
                    />
                    <input
                      id="filter-player2"
                      type="text"
                      value={filterPlayer2}
                      onChange={(e) => setFilterPlayer2(e.target.value)}
                      placeholder="Player 2"
                      className="rounded border border-gray-600 bg-gray-800/80 px-2 py-1 text-xs text-gray-100 placeholder-gray-500 focus:border-mariner-500 focus:outline-none focus:ring-1 focus:ring-mariner-500"
                    />
                  </div>

                  {/* VS separator */}
                  <div className="flex items-center justify-center text-[10px] text-gray-500">
                    vs
                  </div>

                  {/* Team 2 */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      id="filter-player3"
                      type="text"
                      value={filterPlayer3}
                      onChange={(e) => setFilterPlayer3(e.target.value)}
                      placeholder="Player 3"
                      className="rounded border border-gray-600 bg-gray-800/80 px-2 py-1 text-xs text-gray-100 placeholder-gray-500 focus:border-mariner-500 focus:outline-none focus:ring-1 focus:ring-mariner-500"
                    />
                    <input
                      id="filter-player4"
                      type="text"
                      value={filterPlayer4}
                      onChange={(e) => setFilterPlayer4(e.target.value)}
                      placeholder="Player 4"
                      className="rounded border border-gray-600 bg-gray-800/80 px-2 py-1 text-xs text-gray-100 placeholder-gray-500 focus:border-mariner-500 focus:outline-none focus:ring-1 focus:ring-mariner-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-1.5">
                    <label
                      htmlFor="filter-type-game"
                      className="flex items-center gap-1 text-[10px] text-gray-300"
                    >
                      <input
                        id="filter-type-game"
                        type="checkbox"
                        checked={includeGame}
                        onChange={(e) => setIncludeGame(e.target.checked)}
                        className="h-3 w-3 rounded border border-gray-600 bg-gray-800/80 text-mariner-500 focus:ring-1 focus:ring-mariner-500"
                      />
                      Game
                    </label>
                    <label
                      htmlFor="filter-type-match"
                      className="flex items-center gap-1 text-[10px] text-gray-300"
                    >
                      <input
                        id="filter-type-match"
                        type="checkbox"
                        checked={includeMatch}
                        onChange={(e) => setIncludeMatch(e.target.checked)}
                        className="h-3 w-3 rounded border border-gray-600 bg-gray-800/80 text-mariner-500 focus:ring-1 focus:ring-mariner-500"
                      />
                      Match
                    </label>
                    <label
                      htmlFor="filter-type-partner"
                      className="flex items-center gap-1 text-[10px] text-gray-300"
                    >
                      <input
                        id="filter-type-partner"
                        type="checkbox"
                        checked={includePartnerGames}
                        onChange={(e) => setIncludePartnerGames(e.target.checked)}
                        className="h-3 w-3 rounded border border-gray-600 bg-gray-800/80 text-mariner-500 focus:ring-1 focus:ring-mariner-500"
                      />
                      Partner games
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          {isEmpty && <NoGamesState />}

          {!isEmpty && !hasFilteredResults && <EmptyState />}

          {hasFilteredResults && (
            <>
              {/* Results count */}
              <div className="mb-4 text-sm text-gray-400">
                Showing {filteredGames.length} of {availableGames.length} games and matches
              </div>

              {/* Games grid */}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {filteredGames.map((game) => (
                  <SharedGameCard
                    key={game.id}
                    game={game}
                    currentUserId={user?.uid ?? null}
                    onDeleted={handleGameDeleted}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
