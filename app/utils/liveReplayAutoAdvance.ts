import type { MatchGame } from "../types/match";

/**
 * Delay in milliseconds before auto-advancing to the next match game
 * after a live replay finishes.
 */
export const LIVE_REPLAY_AUTO_ADVANCE_DELAY_MS = 2000;

export type LiveReplayAutoAdvanceParams = {
  autoAdvanceEnabled: boolean;
  matchGames: MatchGame[];
  matchCurrentIndex: number;
  delayMs?: number;
  /**
   * Called immediately when an auto-advance is scheduled.
   */
  onScheduled?: (nextGame: MatchGame, nextIndex: number, delayMs: number) => void;
  onAdvance: (nextGame: MatchGame, nextIndex: number) => void;
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
