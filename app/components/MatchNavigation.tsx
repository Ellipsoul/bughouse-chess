"use client";

import React, { useRef, useState, useEffect } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { APP_TOOLTIP_ID } from "../utils/tooltips";
import type { MatchDiscoveryStatus, MatchGame } from "../types/match";

/**
 * Extracts a display-friendly summary of a match game for the dropdown.
 * Returns team names, colors, and result.
 */
export interface GameSummary {
  /** Game index (1-based for display) */
  gameNumber: number;
  /** Board A white player username */
  boardAWhite: string;
  /** Board A black player username */
  boardABlack: string;
  /** Board B white player username */
  boardBWhite: string;
  /** Board B black player username */
  boardBBlack: string;
  /** Game result (e.g., "1-0", "0-1", "1/2-1/2") */
  result: string;
  /** Which team won: "team1" (boardA white + boardB black), "team2", or "draw" */
  winningTeam: "team1" | "team2" | "draw";
}

/**
 * Extracts game summary from a MatchGame for dropdown display.
 */
export function extractGameSummary(game: MatchGame, index: number): GameSummary {
  const original = game.original;
  const partner = game.partner;

  // Get player names from both boards
  const boardAWhite = original.game.pgnHeaders.White;
  const boardABlack = original.game.pgnHeaders.Black;
  const boardBWhite = partner?.game.pgnHeaders.White ?? "Unknown";
  const boardBBlack = partner?.game.pgnHeaders.Black ?? "Unknown";

  // Get result
  const result = original.game.pgnHeaders.Result;

  // Determine winning team
  // In bughouse: Team 1 = boardA white + boardB black, Team 2 = boardA black + boardB white
  // Result is from board A perspective
  let winningTeam: "team1" | "team2" | "draw" = "draw";
  if (result === "1-0") {
    winningTeam = "team1"; // Board A white won
  } else if (result === "0-1") {
    winningTeam = "team2"; // Board A black won
  }

  return {
    gameNumber: index + 1,
    boardAWhite,
    boardABlack,
    boardBWhite,
    boardBBlack,
    result,
    winningTeam,
  };
}

/**
 * Match score summary computed from all games.
 */
export interface MatchScore {
  /** Number of games won by Team 1 (boardA white + boardB black) */
  team1Wins: number;
  /** Number of games won by Team 2 (boardA black + boardB white) */
  team2Wins: number;
  /** Number of draws */
  draws: number;
}

/**
 * Computes the overall match score from an array of match games.
 * @param games - Array of MatchGame objects
 * @returns MatchScore with team1Wins, team2Wins, and draws
 */
export function computeMatchScore(games: MatchGame[]): MatchScore {
  let team1Wins = 0;
  let team2Wins = 0;
  let draws = 0;

  for (const game of games) {
    const result = game.original.game.pgnHeaders.Result;
    if (result === "1-0") {
      team1Wins++;
    } else if (result === "0-1") {
      team2Wins++;
    } else {
      // "1/2-1/2" or any other result counts as a draw
      draws++;
    }
  }

  return { team1Wins, team2Wins, draws };
}

/**
 * Props for the MatchNavigation component.
 */
export interface MatchNavigationProps {
  /**
   * Whether a game is currently loaded (enables/disables the Find Match button).
   */
  hasGameLoaded: boolean;
  /**
   * Current status of match discovery.
   */
  discoveryStatus: MatchDiscoveryStatus;
  /**
   * Total number of games found in the match (including initial game).
   */
  totalGames: number;
  /**
   * Index of the currently displayed game (0-based).
   */
  currentIndex: number;
  /**
   * Array of match games for the dropdown (optional, only needed when showing dropdown).
   */
  matchGames?: MatchGame[];
  /**
   * Callback when user clicks "Find Match Games".
   */
  onFindMatchGames: () => void;
  /**
   * Callback when user clicks Previous Game.
   */
  onPreviousGame: () => void;
  /**
   * Callback when user clicks Next Game.
   */
  onNextGame: () => void;
  /**
   * Callback when user selects a game from the dropdown.
   */
  onSelectGame?: (index: number) => void;
  /**
   * Whether any action is currently pending (disables buttons).
   */
  isPending?: boolean;
}

/**
 * Navigation controls for match replay functionality.
 *
 * Displays:
 * - "Find Match Games" button when no match is loaded
 * - Previous/Next navigation + game counter when match is discovered
 * - Loading indicator during discovery
 * - Dropdown menu for quick game selection
 */
export default function MatchNavigation({
  hasGameLoaded,
  discoveryStatus,
  totalGames,
  currentIndex,
  matchGames = [],
  onFindMatchGames,
  onPreviousGame,
  onNextGame,
  onSelectGame,
  isPending = false,
}: MatchNavigationProps) {
  const isDiscovering = discoveryStatus === "discovering";
  const hasMatch = totalGames > 1;
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < totalGames - 1;

  // Dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isDropdownOpen]);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isDropdownOpen]);

  // Show game counter as "Game X of Y"
  const gameCounter = hasMatch ? `Game ${currentIndex + 1} of ${totalGames}` : null;

  // Determine what to show based on state
  const showFindButton = discoveryStatus === "idle" && !hasMatch;
  const showNavigation = hasMatch || isDiscovering;

  const handleSelectGame = (index: number) => {
    setIsDropdownOpen(false);
    onSelectGame?.(index);
  };

  return (
    <div className="flex items-center gap-2">
      {showFindButton && (
        <button
          type="button"
          onClick={onFindMatchGames}
          disabled={!hasGameLoaded || isPending}
          aria-label="Find match games"
          data-tooltip-id={APP_TOOLTIP_ID}
          data-tooltip-content={
            hasGameLoaded
              ? "Find other games in this match"
              : "Load a game first to find match games"
          }
          data-tooltip-place="bottom"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-gray-600 bg-gray-900/60 text-gray-100 hover:bg-gray-900/80 hover:border-gray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900 disabled:bg-gray-800 disabled:text-gray-500 disabled:border-gray-700 disabled:cursor-not-allowed"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Find Match Games</span>
          <span className="sm:hidden">Find Match</span>
        </button>
      )}

      {showNavigation && (
        <div className="flex items-center gap-1.5">
          {/* Previous button */}
          <button
            type="button"
            onClick={onPreviousGame}
            disabled={!canGoPrevious || isPending || isDiscovering}
            aria-label="Previous game"
            data-tooltip-id={APP_TOOLTIP_ID}
            data-tooltip-content="Previous game in match"
            data-tooltip-place="bottom"
            className="inline-flex items-center justify-center p-1.5 rounded border border-gray-600 bg-gray-900/60 text-gray-100 hover:bg-gray-900/80 hover:border-gray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900 disabled:bg-gray-800 disabled:text-gray-500 disabled:border-gray-700 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Game counter or loading indicator */}
          <div className="relative min-w-[100px] flex items-center justify-center" ref={dropdownRef}>
            {isDiscovering ? (
              <span className="inline-flex items-center justify-center gap-1.5 text-sm text-gray-300">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span className="hidden sm:inline">Finding games...</span>
                <span className="sm:hidden">
                  {totalGames > 1 ? `${totalGames} found` : "Searching..."}
                </span>
              </span>
            ) : gameCounter ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  disabled={isPending}
                  aria-label="Select game from match"
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="listbox"
                  className="inline-flex items-center gap-1 text-sm font-medium text-gray-200 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>{gameCounter}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>

                {/* Dropdown menu */}
                {isDropdownOpen && matchGames.length > 0 && (
                  <div
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 w-64 rounded-md border border-gray-600 bg-gray-800 shadow-lg"
                    role="listbox"
                    aria-label="Select a game"
                  >
                    {/* Scrollable game list with custom thin scrollbar */}
                    <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500">
                      {matchGames.map((game, index) => {
                        const summary = extractGameSummary(game, index);
                        const isCurrentGame = index === currentIndex;

                        return (
                          <button
                            key={game.gameId}
                            type="button"
                            role="option"
                            aria-selected={isCurrentGame}
                            onClick={() => handleSelectGame(index)}
                            className={`w-full px-2 py-1.5 text-left transition-colors ${
                              isCurrentGame
                                ? "bg-mariner-600/30 border-l-2 border-mariner-400"
                                : "hover:bg-gray-700/60"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              {/* Game number */}
                              <span className="text-[10px] font-medium text-gray-400 w-8 shrink-0">
                                #{summary.gameNumber}
                              </span>

                              {/* Team 1 (boardA white + boardB black) */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="w-2 h-2 bg-white border border-gray-500 shrink-0" />
                                  <span className="text-[10px] text-gray-200 truncate">
                                    {summary.boardAWhite}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="w-2 h-2 bg-gray-900 border border-gray-500 shrink-0" />
                                  <span className="text-[10px] text-gray-200 truncate">
                                    {summary.boardBBlack}
                                  </span>
                                </div>
                              </div>

                              {/* Result */}
                              <span
                                className={`text-[10px] font-bold shrink-0 px-1 ${
                                  summary.winningTeam === "team1"
                                    ? "text-green-400"
                                    : summary.winningTeam === "team2"
                                      ? "text-red-400"
                                      : "text-gray-400"
                                }`}
                              >
                                {summary.result}
                              </span>

                              {/* Team 2 (boardA black + boardB white) */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-[10px] text-gray-200 truncate">
                                    {summary.boardABlack}
                                  </span>
                                  <span className="w-2 h-2 bg-gray-900 border border-gray-500 shrink-0" />
                                </div>
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-[10px] text-gray-200 truncate">
                                    {summary.boardBWhite}
                                  </span>
                                  <span className="w-2 h-2 bg-white border border-gray-500 shrink-0" />
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Match score summary */}
                    {matchGames.length > 0 && (
                      <MatchScoreSummary games={matchGames} />
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Next button */}
          <button
            type="button"
            onClick={onNextGame}
            disabled={!canGoNext || isPending || isDiscovering}
            aria-label="Next game"
            data-tooltip-id={APP_TOOLTIP_ID}
            data-tooltip-content="Next game in match"
            data-tooltip-place="bottom"
            className="inline-flex items-center justify-center p-1.5 rounded border border-gray-600 bg-gray-900/60 text-gray-100 hover:bg-gray-900/80 hover:border-gray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900 disabled:bg-gray-800 disabled:text-gray-500 disabled:border-gray-700 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Error state */}
      {discoveryStatus === "error" && (
        <button
          type="button"
          onClick={onFindMatchGames}
          disabled={!hasGameLoaded || isPending}
          aria-label="Retry finding match games"
          data-tooltip-id={APP_TOOLTIP_ID}
          data-tooltip-content="Failed to find match games. Click to retry."
          data-tooltip-place="bottom"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-red-600/60 bg-red-900/20 text-red-300 hover:bg-red-900/30 hover:border-red-500/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}

/**
 * Displays the final match score summary at the bottom of the dropdown.
 */
function MatchScoreSummary({ games }: { games: MatchGame[] }) {
  const score = computeMatchScore(games);

  // Get team names from first game for display
  const firstGame = games[0];
  if (!firstGame) return null;

  const team1Player1 = firstGame.original.game.pgnHeaders.White;
  const team1Player2 = firstGame.partner?.game.pgnHeaders.Black ?? "Unknown";
  const team2Player1 = firstGame.original.game.pgnHeaders.Black;
  const team2Player2 = firstGame.partner?.game.pgnHeaders.White ?? "Unknown";

  return (
    <div className="border-t-2 border-gray-600 px-2 py-2 bg-gray-800/80">
      <div className="flex items-center justify-between gap-2">
        {/* Team 1 names */}
        <div className="flex-1 min-w-0 text-left">
          <span className="text-[9px] text-gray-400 truncate block">
            {team1Player1}
          </span>
          <span className="text-[9px] text-gray-400 truncate block">
            {team1Player2}
          </span>
        </div>

        {/* Final score */}
        <div className="shrink-0 text-center">
          <span className="text-[11px] font-bold text-gray-200">
            <span className="text-green-400">{score.team1Wins}</span>
            <span className="text-gray-500 mx-1">-</span>
            <span className="text-red-400">{score.team2Wins}</span>
          </span>
          {score.draws > 0 && (
            <span className="text-[9px] text-gray-500 block">
              ({score.draws} draw{score.draws !== 1 ? "s" : ""})
            </span>
          )}
        </div>

        {/* Team 2 names */}
        <div className="flex-1 min-w-0 text-right">
          <span className="text-[9px] text-gray-400 truncate block">
            {team2Player1}
          </span>
          <span className="text-[9px] text-gray-400 truncate block">
            {team2Player2}
          </span>
        </div>
      </div>
    </div>
  );
}
