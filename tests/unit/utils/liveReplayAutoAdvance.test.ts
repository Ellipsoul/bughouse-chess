import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchGame } from "../../../app/types/match";
import {
  LIVE_REPLAY_AUTO_ADVANCE_DELAY_MS,
  scheduleLiveReplayAutoAdvance,
} from "../../../app/utils/liveReplayAutoAdvance";
import type { ChessGame } from "../../../app/actions";

function createChessGame(id: string): ChessGame {
  return {
    game: {
      id,
      pgnHeaders: {
        White: "PlayerA",
        Black: "PlayerB",
      },
    },
  } as unknown as ChessGame;
}

function createMatchGame(gameId: string, partnerGameId: string): MatchGame {
  return {
    gameId,
    partnerGameId,
    original: createChessGame(gameId),
    partner: createChessGame(partnerGameId),
    endTime: 1,
  };
}

describe("scheduleLiveReplayAutoAdvance", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing when auto-advance is disabled", () => {
    const onAdvance = vi.fn();
    const onMatchEnd = vi.fn();

    const timeoutId = scheduleLiveReplayAutoAdvance({
      autoAdvanceEnabled: false,
      matchGames: [createMatchGame("1001", "2001")],
      matchCurrentIndex: 0,
      onAdvance,
      onMatchEnd,
    });

    expect(timeoutId).toBeNull();
    vi.runAllTimers();
    expect(onAdvance).not.toHaveBeenCalled();
    expect(onMatchEnd).not.toHaveBeenCalled();
  });

  it("notifies immediately when the match is already finished", () => {
    const onAdvance = vi.fn();
    const onMatchEnd = vi.fn();

    const timeoutId = scheduleLiveReplayAutoAdvance({
      autoAdvanceEnabled: true,
      matchGames: [createMatchGame("1001", "2001")],
      matchCurrentIndex: 0,
      onAdvance,
      onMatchEnd,
    });

    expect(timeoutId).toBeNull();
    expect(onMatchEnd).toHaveBeenCalledTimes(1);
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it("delays auto-advance by the configured timeout", () => {
    const onAdvance = vi.fn();
    const onMatchEnd = vi.fn();
    const onScheduled = vi.fn();
    const matchGames = [createMatchGame("1001", "2001"), createMatchGame("1002", "2002")];

    const timeoutId = scheduleLiveReplayAutoAdvance({
      autoAdvanceEnabled: true,
      matchGames,
      matchCurrentIndex: 0,
      onScheduled,
      onAdvance,
      onMatchEnd,
    });

    expect(timeoutId).not.toBeNull();
    expect(onScheduled).toHaveBeenCalledTimes(1);
    expect(onScheduled).toHaveBeenCalledWith(
      matchGames[1],
      1,
      LIVE_REPLAY_AUTO_ADVANCE_DELAY_MS,
    );
    expect(onAdvance).not.toHaveBeenCalled();

    vi.advanceTimersByTime(LIVE_REPLAY_AUTO_ADVANCE_DELAY_MS - 1);
    expect(onAdvance).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(onAdvance).toHaveBeenCalledWith(matchGames[1], 1);
    expect(onMatchEnd).not.toHaveBeenCalled();
  });
});
