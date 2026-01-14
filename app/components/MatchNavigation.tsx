"use client";

import React, { useRef, useState, useEffect } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { APP_TOOLTIP_ID } from "../utils/tooltips";
import type { MatchDiscoveryStatus, MatchGame, PartnerPair } from "../types/match";

/**
 * Reference team composition established from the first game.
 * Teams are identified by player names (case-insensitive) to handle color swaps.
 */
export interface ReferenceTeams {
  /** Team 1 players (sorted lowercase for comparison) */
  team1: Set<string>;
  /** Team 2 players (sorted lowercase for comparison) */
  team2: Set<string>;
  /** Display names for Team 1 (original case) */
  team1Display: [string, string];
  /** Display names for Team 2 (original case) */
  team2Display: [string, string];
}

/**
 * Establishes reference teams from the first game in a match.
 * Team1 = boardA white + boardB black, Team2 = boardA black + boardB white.
 */
export function establishReferenceTeams(firstGame: MatchGame): ReferenceTeams {
  const boardAWhite = firstGame.original.game.pgnHeaders.White;
  const boardABlack = firstGame.original.game.pgnHeaders.Black;
  const boardBWhite = firstGame.partner?.game.pgnHeaders.White ?? "Unknown";
  const boardBBlack = firstGame.partner?.game.pgnHeaders.Black ?? "Unknown";

  return {
    team1: new Set([boardAWhite.toLowerCase(), boardBBlack.toLowerCase()]),
    team2: new Set([boardABlack.toLowerCase(), boardBWhite.toLowerCase()]),
    team1Display: [boardAWhite, boardBBlack],
    team2Display: [boardABlack, boardBWhite],
  };
}

/**
 * Checks if the current game's white player on board A is from the reference Team1.
 */
export function isTeam1PlayingWhite(game: MatchGame, refTeams: ReferenceTeams): boolean {
  const currentWhite = game.original.game.pgnHeaders.White.toLowerCase();
  return refTeams.team1.has(currentWhite);
}

/**
 * Extracts a display-friendly summary of a match game for the dropdown.
 * Uses reference teams to maintain consistent player positioning.
 */
export interface GameSummary {
  /** Game index (1-based for display) */
  gameNumber: number;
  /** Team 1 player on board A */
  team1BoardA: string;
  /** Team 1 player on board B */
  team1BoardB: string;
  /** Team 2 player on board A */
  team2BoardA: string;
  /** Team 2 player on board B */
  team2BoardB: string;
  /** Whether Team 1 is playing white this game */
  team1IsWhite: boolean;
  /** Original game result from PGN (e.g., "1-0", "0-1", "1/2-1/2") */
  result: string;
  /**
   * Display result from Team 1's perspective (left side of dropdown).
   * "1-0" means Team 1 won, "0-1" means Team 2 won.
   */
  displayResult: string;
  /** Which team won from the reference perspective */
  winningTeam: "team1" | "team2" | "draw";
}

/**
 * Extracts game summary from a MatchGame for dropdown display.
 * @param game - The match game to extract summary from
 * @param index - The 0-based index of this game in the match
 * @param refTeams - Reference teams established from the first game
 */
export function extractGameSummary(
  game: MatchGame,
  index: number,
  refTeams?: ReferenceTeams,
): GameSummary {
  const original = game.original;
  const partner = game.partner;

  // Get player names from both boards
  const boardAWhite = original.game.pgnHeaders.White;
  const boardABlack = original.game.pgnHeaders.Black;
  const boardBWhite = partner?.game.pgnHeaders.White ?? "Unknown";
  const boardBBlack = partner?.game.pgnHeaders.Black ?? "Unknown";

  // Get result
  const result = original.game.pgnHeaders.Result;

  // If no reference teams provided, use this game to establish them
  // (backwards compatibility for tests that don't provide refTeams)
  const effectiveRefTeams = refTeams ?? establishReferenceTeams(game);
  const team1PlayingWhite = isTeam1PlayingWhite(game, effectiveRefTeams);

  // Assign players to teams based on reference
  let team1BoardA: string;
  let team1BoardB: string;
  let team2BoardA: string;
  let team2BoardB: string;

  if (team1PlayingWhite) {
    // Team 1 has white on board A, black on board B
    team1BoardA = boardAWhite;
    team1BoardB = boardBBlack;
    team2BoardA = boardABlack;
    team2BoardB = boardBWhite;
  } else {
    // Team 1 has black on board A, white on board B (swapped)
    team1BoardA = boardABlack;
    team1BoardB = boardBWhite;
    team2BoardA = boardAWhite;
    team2BoardB = boardBBlack;
  }

  // Determine winning team from reference perspective
  let winningTeam: "team1" | "team2" | "draw" = "draw";
  if (result === "1-0") {
    // Board A white won
    winningTeam = team1PlayingWhite ? "team1" : "team2";
  } else if (result === "0-1") {
    // Board A black won
    winningTeam = team1PlayingWhite ? "team2" : "team1";
  }

  // Compute display result from Team 1's perspective (left side of dropdown)
  // "1-0" = Team 1 won, "0-1" = Team 2 won
  let displayResult: string;
  if (winningTeam === "team1") {
    displayResult = "1-0";
  } else if (winningTeam === "team2") {
    displayResult = "0-1";
  } else {
    // Keep original draw notation (could be "1/2-1/2", "*", etc.)
    displayResult = result;
  }

  return {
    gameNumber: index + 1,
    team1BoardA,
    team1BoardB,
    team2BoardA,
    team2BoardB,
    team1IsWhite: team1PlayingWhite,
    result,
    displayResult,
    winningTeam,
  };
}

/**
 * Match score summary computed from all games.
 */
export interface MatchScore {
  /** Number of games won by reference Team 1 */
  team1Wins: number;
  /** Number of games won by reference Team 2 */
  team2Wins: number;
  /** Number of draws */
  draws: number;
}

/**
 * Summary of a game from the partner pair's perspective.
 */
export interface PartnerPairGameSummary {
  /** Game index (1-based for display) */
  gameNumber: number;
  /** Partner on board A */
  pairBoardA: string;
  /** Partner on board B */
  pairBoardB: string;
  /** Opponent on board A */
  opponentBoardA: string;
  /** Opponent on board B */
  opponentBoardB: string;
  /** Whether the partner pair is playing white on board A */
  pairIsWhiteOnBoardA: boolean;
  /** Original game result from PGN */
  result: string;
  /** Display result from pair's perspective ("1-0" = pair won) */
  displayResult: string;
  /** Whether the partner pair won */
  pairWon: boolean;
  /** Whether the partner pair lost */
  pairLost: boolean;
}

/**
 * Extracts game summary from the selected partner pair's perspective.
 * @param game - The match game to extract summary from
 * @param index - The 0-based index of this game in the series
 * @param selectedPair - The selected partner pair
 */
export function extractPartnerPairGameSummary(
  game: MatchGame,
  index: number,
  selectedPair: PartnerPair,
): PartnerPairGameSummary {
  const original = game.original;
  const partner = game.partner;

  const boardAWhite = original.game.pgnHeaders.White;
  const boardABlack = original.game.pgnHeaders.Black;
  const boardBWhite = partner?.game.pgnHeaders.White ?? "Unknown";
  const boardBBlack = partner?.game.pgnHeaders.Black ?? "Unknown";
  const result = original.game.pgnHeaders.Result;

  // Check which color the selected pair is playing on board A
  const pairUsernames = new Set(selectedPair.usernames);
  const boardAWhiteLower = boardAWhite.toLowerCase();

  // If board A white is in the selected pair, they're playing white on board A
  const pairIsWhiteOnBoardA = pairUsernames.has(boardAWhiteLower);

  let pairBoardA: string;
  let pairBoardB: string;
  let opponentBoardA: string;
  let opponentBoardB: string;

  if (pairIsWhiteOnBoardA) {
    // Pair is white on A, black on B (normal partner pairing)
    pairBoardA = boardAWhite;
    pairBoardB = boardBBlack;
    opponentBoardA = boardABlack;
    opponentBoardB = boardBWhite;
  } else {
    // Pair is black on A, white on B
    pairBoardA = boardABlack;
    pairBoardB = boardBWhite;
    opponentBoardA = boardAWhite;
    opponentBoardB = boardBBlack;
  }

  // Determine if pair won
  let pairWon = false;
  let pairLost = false;

  if (result === "1-0") {
    // Board A white won
    pairWon = pairIsWhiteOnBoardA;
    pairLost = !pairIsWhiteOnBoardA;
  } else if (result === "0-1") {
    // Board A black won
    pairWon = !pairIsWhiteOnBoardA;
    pairLost = pairIsWhiteOnBoardA;
  }

  // Display result from pair's perspective
  let displayResult: string;
  if (pairWon) {
    displayResult = "1-0";
  } else if (pairLost) {
    displayResult = "0-1";
  } else {
    displayResult = result;
  }

  return {
    gameNumber: index + 1,
    pairBoardA,
    pairBoardB,
    opponentBoardA,
    opponentBoardB,
    pairIsWhiteOnBoardA,
    result,
    displayResult,
    pairWon,
    pairLost,
  };
}

/**
 * Partner pair series score.
 */
export interface PartnerPairScore {
  /** Number of games won by the partner pair */
  pairWins: number;
  /** Number of games lost by the partner pair */
  pairLosses: number;
  /** Number of draws */
  draws: number;
}

/**
 * Computes the series score for a partner pair.
 * @param games - Array of MatchGame objects
 * @param selectedPair - The selected partner pair
 * @returns PartnerPairScore with wins, losses, and draws
 */
export function computePartnerPairScore(
  games: MatchGame[],
  selectedPair: PartnerPair,
): PartnerPairScore {
  if (games.length === 0) {
    return { pairWins: 0, pairLosses: 0, draws: 0 };
  }

  let pairWins = 0;
  let pairLosses = 0;
  let draws = 0;

  for (let i = 0; i < games.length; i++) {
    const summary = extractPartnerPairGameSummary(games[i], i, selectedPair);
    if (summary.pairWon) {
      pairWins++;
    } else if (summary.pairLost) {
      pairLosses++;
    } else {
      draws++;
    }
  }

  return { pairWins, pairLosses, draws };
}

/**
 * Computes the overall match score from an array of match games.
 * Uses reference teams from the first game to correctly attribute wins
 * even when teams swap colors between games.
 * @param games - Array of MatchGame objects
 * @returns MatchScore with team1Wins, team2Wins, and draws
 */
export function computeMatchScore(games: MatchGame[]): MatchScore {
  if (games.length === 0) {
    return { team1Wins: 0, team2Wins: 0, draws: 0 };
  }

  const refTeams = establishReferenceTeams(games[0]);
  let team1Wins = 0;
  let team2Wins = 0;
  let draws = 0;

  for (const game of games) {
    const result = game.original.game.pgnHeaders.Result;
    const team1PlayingWhite = isTeam1PlayingWhite(game, refTeams);

    if (result === "1-0") {
      // Board A white won
      if (team1PlayingWhite) {
        team1Wins++;
      } else {
        team2Wins++;
      }
    } else if (result === "0-1") {
      // Board A black won
      if (team1PlayingWhite) {
        team2Wins++;
      } else {
        team1Wins++;
      }
    } else {
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
   * The selected partner pair for partner pair discovery mode.
   * When set, the dropdown will show this pair on the left side.
   */
  selectedPair?: PartnerPair | null;
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
  /**
   * Visual density hint used by the top navigation header.
   * - `default`: existing spacing/typography (tablet/desktop)
   * - `compact`: reduced padding + slightly smaller icons/text (phone landscape)
   */
  density?: "default" | "compact";
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
  selectedPair = null,
  onFindMatchGames,
  onPreviousGame,
  onNextGame,
  onSelectGame,
  isPending = false,
  density = "default",
}: MatchNavigationProps) {
  const isCompact = density === "compact";
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

  const iconClassName = isCompact ? "h-3.5 w-3.5" : "h-4 w-4";
  const findButtonClassName = [
    "inline-flex items-center rounded border border-gray-600 bg-gray-900/60 text-gray-100 hover:bg-gray-900/80 hover:border-gray-500 transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900",
    "disabled:bg-gray-800 disabled:text-gray-500 disabled:border-gray-700 disabled:cursor-not-allowed",
    isCompact ? "gap-1 px-2 py-1 text-xs" : "gap-1.5 px-3 py-1.5 text-sm",
  ].join(" ");

  const navButtonClassName = [
    "inline-flex items-center justify-center rounded border border-gray-600 bg-gray-900/60 text-gray-100 hover:bg-gray-900/80 hover:border-gray-500 transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900",
    "disabled:bg-gray-800 disabled:text-gray-500 disabled:border-gray-700 disabled:cursor-not-allowed",
    isCompact ? "p-1" : "p-1.5",
  ].join(" ");

  const gameCounterButtonClassName = [
    "inline-flex items-center gap-1 font-medium text-gray-200 hover:text-white transition-colors cursor-pointer",
    "disabled:cursor-not-allowed disabled:opacity-50",
    isCompact ? "text-xs" : "text-sm",
  ].join(" ");

  const handleSelectGame = (index: number) => {
    setIsDropdownOpen(false);
    onSelectGame?.(index);
  };

  return (
    <div className="flex items-center gap-2" data-testid="match-navigation">
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
          className={findButtonClassName}
        >
          <Search className={iconClassName} aria-hidden="true" />
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
            className={navButtonClassName}
          >
            <ChevronLeft className={iconClassName} aria-hidden="true" />
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
                  className={gameCounterButtonClassName}
                >
                  <span>{gameCounter}</span>
                  <ChevronDown
                    className={`${iconClassName} transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>

                {/* Dropdown menu */}
                {isDropdownOpen && matchGames.length > 0 && (
                  <MatchDropdown
                    games={matchGames}
                    currentIndex={currentIndex}
                    selectedPair={selectedPair}
                    onSelectGame={handleSelectGame}
                  />
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
            className={navButtonClassName}
          >
            <ChevronRight className={iconClassName} aria-hidden="true" />
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
          className={[
            "inline-flex items-center rounded border border-red-600/60 bg-red-900/20 text-red-300 hover:bg-red-900/30 hover:border-red-500/60 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900",
            isCompact ? "gap-1 px-2 py-1 text-xs" : "gap-1.5 px-3 py-1.5 text-sm",
          ].join(" ")}
        >
          <Search className={iconClassName} aria-hidden="true" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}

/**
 * Dropdown component showing all games in a match with consistent team positioning.
 * For partner pair mode, shows the selected pair on the left and opponents on the right.
 */
function MatchDropdown({
  games,
  currentIndex,
  selectedPair,
  onSelectGame,
}: {
  games: MatchGame[];
  currentIndex: number;
  selectedPair?: PartnerPair | null;
  onSelectGame: (index: number) => void;
}) {
  if (games.length === 0) return null;

  // For partner pair mode, we use the selectedPair directly
  // For full match mode, establish reference teams from first game
  const refTeams = establishReferenceTeams(games[0]);
  const isPartnerPairMode = selectedPair != null;

  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 w-64 rounded-md border border-gray-600 bg-gray-800 shadow-lg"
      role="listbox"
      aria-label="Select a game"
    >
      {/* Scrollable game list with custom thin scrollbar */}
      <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500">
        {games.map((game, index) => {
          const isCurrentGame = index === currentIndex;

          // Render differently based on mode
          if (isPartnerPairMode) {
            const pairSummary = extractPartnerPairGameSummary(game, index, selectedPair);
            return (
              <button
                key={game.gameId}
                type="button"
                role="option"
                aria-selected={isCurrentGame}
                onClick={() => onSelectGame(index)}
                className={`w-full px-2 py-1.5 text-left transition-colors ${
                  isCurrentGame
                    ? "bg-mariner-600/30 border-l-2 border-mariner-400"
                    : "hover:bg-gray-700/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Game number */}
                  <span className="text-[10px] font-medium text-gray-400 w-8 shrink-0">
                    #{pairSummary.gameNumber}
                  </span>

                  {/* Partner pair - always on left side */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span
                        className={`w-2 h-2 border border-gray-500 shrink-0 ${
                          pairSummary.pairIsWhiteOnBoardA ? "bg-white" : "bg-gray-900"
                        }`}
                      />
                      <span className="text-[10px] text-gray-200 truncate">
                        {pairSummary.pairBoardA}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className={`w-2 h-2 border border-gray-500 shrink-0 ${
                          pairSummary.pairIsWhiteOnBoardA ? "bg-gray-900" : "bg-white"
                        }`}
                      />
                      <span className="text-[10px] text-gray-200 truncate">
                        {pairSummary.pairBoardB}
                      </span>
                    </div>
                  </div>

                  {/* Result */}
                  <span
                    className={`text-[10px] font-bold shrink-0 px-1 ${
                      pairSummary.pairWon
                        ? "text-green-400"
                        : pairSummary.pairLost
                          ? "text-red-400"
                          : "text-gray-400"
                    }`}
                  >
                    {pairSummary.displayResult}
                  </span>

                  {/* Opponents - always on right side */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-[10px] text-gray-200 truncate">
                        {pairSummary.opponentBoardA}
                      </span>
                      <span
                        className={`w-2 h-2 border border-gray-500 shrink-0 ${
                          pairSummary.pairIsWhiteOnBoardA ? "bg-gray-900" : "bg-white"
                        }`}
                      />
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-[10px] text-gray-200 truncate">
                        {pairSummary.opponentBoardB}
                      </span>
                      <span
                        className={`w-2 h-2 border border-gray-500 shrink-0 ${
                          pairSummary.pairIsWhiteOnBoardA ? "bg-white" : "bg-gray-900"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </button>
            );
          }

          // Full match mode
          const summary = extractGameSummary(game, index, refTeams);
          return (
            <button
              key={game.gameId}
              type="button"
              role="option"
              aria-selected={isCurrentGame}
              onClick={() => onSelectGame(index)}
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

                {/* Team 1 - always on left side */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span
                      className={`w-2 h-2 border border-gray-500 shrink-0 ${
                        summary.team1IsWhite ? "bg-white" : "bg-gray-900"
                      }`}
                    />
                    <span className="text-[10px] text-gray-200 truncate">
                      {summary.team1BoardA}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`w-2 h-2 border border-gray-500 shrink-0 ${
                        summary.team1IsWhite ? "bg-gray-900" : "bg-white"
                      }`}
                    />
                    <span className="text-[10px] text-gray-200 truncate">
                      {summary.team1BoardB}
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
                  {summary.displayResult}
                </span>

                {/* Team 2 - always on right side */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-[10px] text-gray-200 truncate">
                      {summary.team2BoardA}
                    </span>
                    <span
                      className={`w-2 h-2 border border-gray-500 shrink-0 ${
                        summary.team1IsWhite ? "bg-gray-900" : "bg-white"
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-[10px] text-gray-200 truncate">
                      {summary.team2BoardB}
                    </span>
                    <span
                      className={`w-2 h-2 border border-gray-500 shrink-0 ${
                        summary.team1IsWhite ? "bg-white" : "bg-gray-900"
                      }`}
                    />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Score summary */}
      {isPartnerPairMode ? (
        <PartnerPairScoreSummary games={games} selectedPair={selectedPair} />
      ) : (
        <MatchScoreSummary games={games} refTeams={refTeams} />
      )}
    </div>
  );
}

/**
 * Displays the final match score summary at the bottom of the dropdown.
 */
function MatchScoreSummary({
  games,
  refTeams,
}: {
  games: MatchGame[];
  refTeams: ReferenceTeams;
}) {
  const score = computeMatchScore(games);

  return (
    <div className="border-t-2 border-gray-600 px-2 py-2 bg-gray-800/80">
      <div className="flex items-center justify-between gap-2">
        {/* Team 1 names */}
        <div className="flex-1 min-w-0 text-left">
          <span className="text-[9px] text-gray-400 truncate block">
            {refTeams.team1Display[0]}
          </span>
          <span className="text-[9px] text-gray-400 truncate block">
            {refTeams.team1Display[1]}
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
            {refTeams.team2Display[0]}
          </span>
          <span className="text-[9px] text-gray-400 truncate block">
            {refTeams.team2Display[1]}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Displays the partner pair series score summary at the bottom of the dropdown.
 */
function PartnerPairScoreSummary({
  games,
  selectedPair,
}: {
  games: MatchGame[];
  selectedPair: PartnerPair;
}) {
  const score = computePartnerPairScore(games, selectedPair);

  return (
    <div className="border-t-2 border-gray-600 px-2 py-2 bg-gray-800/80">
      <div className="flex items-center justify-between gap-2">
        {/* Partner pair names */}
        <div className="flex-1 min-w-0 text-left">
          <span className="text-[9px] text-gray-400 truncate block">
            {selectedPair.displayNames[0]}
          </span>
          <span className="text-[9px] text-gray-400 truncate block">
            {selectedPair.displayNames[1]}
          </span>
        </div>

        {/* Final score */}
        <div className="shrink-0 text-center">
          <span className="text-[11px] font-bold text-gray-200">
            <span className="text-green-400">{score.pairWins}</span>
            <span className="text-gray-500 mx-1">-</span>
            <span className="text-red-400">{score.pairLosses}</span>
          </span>
          {score.draws > 0 && (
            <span className="text-[9px] text-gray-500 block">
              ({score.draws} draw{score.draws !== 1 ? "s" : ""})
            </span>
          )}
        </div>

        {/* "vs Various" label for opponents */}
        <div className="flex-1 min-w-0 text-right">
          <span className="text-[9px] text-gray-500 italic block">
            vs various
          </span>
          <span className="text-[9px] text-gray-500 italic block">
            opponents
          </span>
        </div>
      </div>
    </div>
  );
}
