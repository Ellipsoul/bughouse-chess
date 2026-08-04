/**
 * Match-level auto-advance after a live replay finishes.
 *
 * When enabled, schedules loading the next game in a match after a configurable delay,
 * giving viewers a brief pause before the next board pair begins.
 */

import type { MatchGame } from "@/app/types/match";

/**
 * Delay in milliseconds before auto-advancing to the next match game
 * after a live replay finishes.
 */
export const LIVE_REPLAY_AUTO_ADVANCE_DELAY_MS = 2000;

/** Parameters for {@link scheduleLiveReplayAutoAdvance}. */
export type LiveReplayAutoAdvanceParams = {
  /** Master switch; when false, no timer is scheduled. */
  autoAdvanceEnabled: boolean;
  /** Ordered list of games in the current match. */
  matchGames: MatchGame[];
  /** Zero-based index of the game whose replay just finished. */
  matchCurrentIndex: number;
  /** Override for the default 2 s pause before advancing. */
  delayMs?: number;
  /**
   * Called immediately when an auto-advance is scheduled.
   * Useful for showing a "next game in N seconds" UI affordance.
   */
  onScheduled?: (nextGame: MatchGame, nextIndex: number, delayMs: number) => void;
  /** Called when the delay elapses and navigation to the next game should occur. */
  onAdvance: (nextGame: MatchGame, nextIndex: number) => void;
  /** Called when the current game is the last in the match (no next game exists). */
  onMatchEnd: () => void;
};

/**
 * Schedules auto-advance to the next match game after a live replay ends.
 * Returns the timer id, or null when no auto-advance is scheduled.
 */
export function scheduleLiveReplayAutoAdvance(
  params: LiveReplayAutoAdvanceParams,
): ReturnType<typeof setTimeout> | null {
  const {
    autoAdvanceEnabled,
    matchGames,
    matchCurrentIndex,
    delayMs = LIVE_REPLAY_AUTO_ADVANCE_DELAY_MS,
    onScheduled,
    onAdvance,
    onMatchEnd,
  } = params;

  if (!autoAdvanceEnabled) return null;
  if (matchGames.length === 0) return null;

  if (matchCurrentIndex >= matchGames.length - 1) {
    onMatchEnd();
    return null;
  }

  const nextIndex = matchCurrentIndex + 1;
  const nextGame = matchGames[nextIndex];
  if (!nextGame) return null;

  onScheduled?.(nextGame, nextIndex, delayMs);

  return setTimeout(() => {
    onAdvance(nextGame, nextIndex);
  }, delayMs);
}
