/**
 * Unit tests for {@link ShareGameModal} sharing flows.
 *
 * Mocks Firestore services and hash store to verify single-game/match/partner
 * share UX, duplicate detection, payload size guards, and post-share cache updates.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";
import type { ChessGame } from "../../../app/actions";
import type { MatchGame, PartnerPair } from "../../../app/types/match";
import type { SingleGameData } from "../../../app/types/sharedGame";
import ShareGameModal from "../../../app/components/shared/ShareGameModal";
import { shareGame, shareMatch } from "../../../app/utils/shared-games/sharedGamesService";
import { revalidateSharedGamesPage } from "../../../app/actions";
import {
  computeShareContentHash,
  createShareHashInputFromMatchGames,
  createShareHashInputFromSingleGame,
} from "../../../app/utils/shared-games/sharedGameHash";
import React from "react";
import toast, { Toaster } from "react-hot-toast";

const sharedGameHashesState = vi.hoisted(() => ({
  hashes: new Set<string>(),
  status: "loaded" as const,
  addHash: vi.fn(),
}));

vi.mock("../../../app/utils/shared-games/sharedGamesService", () => ({
  MATCH_UPLOAD_BATCH_SIZE: 100,
  shareGame: vi.fn(),
  shareMatch: vi.fn(),
}));

vi.mock("../../../app/actions", () => ({
  revalidateSharedGamesPage: vi.fn(),
}));

vi.mock("@/app/utils/platform/useFirebaseAnalytics", () => ({
  useFirebaseAnalytics: () => ({ logEvent: vi.fn() }),
  logAnalyticsEvent: vi.fn(),
}));

vi.mock("react-hot-toast", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-hot-toast")>();
  return {
    ...actual,
    default: Object.assign((...args: Parameters<typeof toast>) => actual.default(...args), actual.default, {
      loading: vi.fn(actual.default.loading),
      success: vi.fn(actual.default.success),
      error: vi.fn(actual.default.error),
      promise: vi.fn(actual.default.promise),
    }),
  };
});

vi.mock("@/app/utils/shared-games/sharedGameHashesStore", () => ({
  useSharedGameHashes: () => ({
    hashes: sharedGameHashesState.hashes,
    status: sharedGameHashesState.status,
    error: null,
    refresh: vi.fn(),
    addHash: sharedGameHashesState.addHash,
  }),
}));

type MatchIndexEntry = {
  gameId: string;
  partnerGameId: string;
  endTime: number;
};

type MatchIndex = {
  games: MatchIndexEntry[];
};

type PartnerSeriesIndex = MatchIndex & {
  selectedPair: [string, string];
};

/** Loads a chess.com live-game JSON fixture from `tests/fixtures/chesscom/`. */
function loadFixture(filename: string): ChessGame {
  return JSON.parse(
    readFileSync(join(process.cwd(), "tests", "fixtures", "chesscom", filename), "utf-8"),
  ) as ChessGame;
}

/** Loads a match or partner-series index JSON fixture. */
function loadIndex<T>(filename: string): T {
  return JSON.parse(
    readFileSync(join(process.cwd(), "tests", "fixtures", "chesscom", filename), "utf-8"),
  ) as T;
}

/** Hydrates {@link MatchGame} rows from index entries plus on-disk game fixtures. */
function loadMatchGames(entries: MatchIndexEntry[]): MatchGame[] {
  return entries.map((entry) => {
    const original = loadFixture(`${entry.gameId}.json`);
    const partner = loadFixture(`${entry.partnerGameId}.json`);

    return {
      gameId: entry.gameId,
      partnerGameId: entry.partnerGameId,
      original,
      partner,
      endTime: entry.endTime ?? original.game.endTime ?? 0,
    };
  });
}

/** Converts a {@link MatchGame} pair into {@link SingleGameData} share payload shape. */
function toSingleGameData(matchGame: MatchGame): SingleGameData {
  return {
    original: matchGame.original,
    partner: matchGame.partner,
    partnerId: matchGame.partnerGameId,
  };
}

/**
 * Clones `seedGame` into `gameCount` synthetic match rows with distinct ids.
 * Used to exercise Firestore batching / size-limit UI without recording extra fixtures.
 */
function createLargeMatchGames(seedGame: MatchGame, gameCount: number): MatchGame[] {
  return Array.from({ length: gameCount }, (_, index) => ({
    gameId: `game-${index}`,
    partnerGameId: `partner-${index}`,
    original: seedGame.original,
    partner: seedGame.partner,
    endTime: seedGame.endTime + index,
  }));
}

describe("ShareGameModal", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    toast.remove();
    vi.clearAllMocks();
    vi.mocked(shareGame).mockResolvedValue({ success: true, sharedId: "shared-game-1" });
    vi.mocked(shareMatch).mockResolvedValue({ success: true, sharedId: "shared-match-1" });
    vi.mocked(revalidateSharedGamesPage).mockResolvedValue(undefined);
    sharedGameHashesState.hashes = new Set();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("defaults to sharing the match series", () => {
    const index = loadIndex<MatchIndex>("match-index.json");
    const matchGames = loadMatchGames(index.games);

    render(
      <ShareGameModal
        open={true}
        userId="user-123"
        username="ellipsoul"
        singleGameData={toSingleGameData(matchGames[0]!)}
        matchGames={matchGames}
        contentType="match"
        selectedPair={null}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Share Match")).toBeInTheDocument();
    const toggle = screen.getByRole("switch", { name: "Share match" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("shares the full match series by default", async () => {
    const index = loadIndex<MatchIndex>("match-index.json");
    const matchGames = loadMatchGames(index.games);

    render(
      <ShareGameModal
        open={true}
        userId="user-123"
        username="ellipsoul"
        singleGameData={toSingleGameData(matchGames[0]!)}
        matchGames={matchGames}
        contentType="match"
        selectedPair={null}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => {
      expect(shareMatch).toHaveBeenCalledWith(
        "user-123",
        "ellipsoul",
        matchGames,
        "match",
        "",
        null,
        expect.objectContaining({
          onBatchProgress: expect.any(Function),
        }),
      );
    });
    expect(shareGame).not.toHaveBeenCalled();
  });

  it("shares a single game when the toggle is off", async () => {
    const index = loadIndex<MatchIndex>("match-index.json");
    const matchGames = loadMatchGames(index.games);
    const singleGameData = toSingleGameData(matchGames[0]!);

    render(
      <ShareGameModal
        open={true}
        userId="user-123"
        username="ellipsoul"
        singleGameData={singleGameData}
        matchGames={matchGames}
        contentType="match"
        selectedPair={null}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: "Share match" }));

    await waitFor(() => {
      expect(screen.getByText("Share Game")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => {
      expect(shareGame).toHaveBeenCalledWith(
        "user-123",
        "ellipsoul",
        singleGameData,
        "",
      );
    });
    expect(shareMatch).not.toHaveBeenCalled();
  });

  it("shares partner series with the correct title", async () => {
    const index = loadIndex<PartnerSeriesIndex>("partner-series-index.json");
    const matchGames = loadMatchGames(index.games);
    const selectedPair: PartnerPair = {
      usernames: index.selectedPair,
      displayNames: index.selectedPair,
    };

    render(
      <ShareGameModal
        open={true}
        userId="user-123"
        username="ellipsoul"
        singleGameData={toSingleGameData(matchGames[0]!)}
        matchGames={matchGames}
        contentType="partnerGames"
        selectedPair={selectedPair}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Share Partner Series")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => {
      expect(shareMatch).toHaveBeenCalledWith(
        "user-123",
        "ellipsoul",
        matchGames,
        "partnerGames",
        "",
        selectedPair,
        expect.objectContaining({
          onBatchProgress: expect.any(Function),
        }),
      );
    });
  });

  it("updates a single toast with batch upload progress for long matches", async () => {
    const index = loadIndex<MatchIndex>("match-index.json");
    const seedGames = loadMatchGames(index.games);
    const largeMatch = createLargeMatchGames(seedGames[0]!, 250);

    vi.mocked(shareMatch).mockImplementation(async (_userId, _username, _games, _type, _description, _selectedPair, options) => {
      options?.onBatchProgress?.({
        uploadedGames: 100,
        totalGames: 250,
        completedBatches: 1,
        totalBatches: 3,
      });
      options?.onBatchProgress?.({
        uploadedGames: 200,
        totalGames: 250,
        completedBatches: 2,
        totalBatches: 3,
      });
      options?.onBatchProgress?.({
        uploadedGames: 250,
        totalGames: 250,
        completedBatches: 3,
        totalBatches: 3,
      });
      return { success: true, sharedId: "shared-match-long" };
    });

    render(
      <ShareGameModal
        open={true}
        userId="user-123"
        username="ellipsoul"
        singleGameData={toSingleGameData(largeMatch[0]!)}
        matchGames={largeMatch}
        contentType="match"
        selectedPair={null}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    render(<Toaster />);
    await waitFor(() => {
      expect(screen.getByText("Match shared successfully!")).toBeInTheDocument();
    });
    const options = vi.mocked(toast.promise).mock.calls[0]![2]!;
    expect(options).toMatchObject({ loading: { duration: Infinity } });
    expect(toast.loading).toHaveBeenCalledWith(
      "Uploading match: 100/250 games",
      { id: options.id, duration: Infinity },
    );
    expect(toast.loading).toHaveBeenCalledWith(
      "Uploading match: 250/250 games",
      { id: options.id, duration: Infinity },
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.promise).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])("shows one failure toast for a long upload (throws: %s)", async (throws) => {
    const index = loadIndex<MatchIndex>("match-index.json");
    const largeMatch = createLargeMatchGames(loadMatchGames(index.games)[0]!, 236);
    const message = "Uploaded 100/236 games before upload failed.";
    vi.mocked(shareMatch).mockImplementation(async (_uid, _name, _games, _type, _desc, _pair, options) => {
      options?.onBatchProgress?.({ uploadedGames: 100, totalGames: 236, completedBatches: 1, totalBatches: 3 });
      if (throws) throw new Error(message);
      return { success: false, error: message };
    });
    const onClose = vi.fn();
    render(<><Toaster /><ShareGameModal open userId="user-123" username="ellipsoul"
      matchGames={largeMatch} contentType="match" onClose={onClose} /></>);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(screen.getByText(message)).toBeInTheDocument());
    expect(toast.promise).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(sharedGameHashesState.addHash).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Share" })).toBeEnabled();
  });

  it.each([1, 20, 100])("transitions one simple promise toast for a %i-game upload", async (count) => {
    const index = loadIndex<MatchIndex>("match-index.json");
    const games = createLargeMatchGames(loadMatchGames(index.games)[0]!, count);
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    vi.mocked(shareMatch).mockImplementation(async (_uid, _name, _games, _type, _desc, _pair, options) => {
      await pending;
      options?.onBatchProgress?.({ uploadedGames: count, totalGames: count, completedBatches: 1, totalBatches: 1 });
      return { success: true, sharedId: "shared" };
    });
    vi.mocked(shareGame).mockImplementation(async () => {
      await pending;
      return { success: true, sharedId: "shared" };
    });
    render(<Toaster />);
    render(<ShareGameModal open userId="user-123" username="ellipsoul"
      singleGameData={toSingleGameData(games[0]!)} matchGames={games}
      contentType={count === 1 ? "game" : "match"} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(screen.getByRole("button", { name: "Sharing..." })).toBeDisabled();
    expect(toast.loading).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    const label = count === 1 ? "Game" : "Match";
    expect(screen.getByText(`Uploading ${label.toLowerCase()}...`)).toBeInTheDocument();
    expect(toast.promise).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => expect(screen.getByText(`${label} shared successfully!`)).toBeInTheDocument());
    expect(screen.queryByText(`Uploading ${label.toLowerCase()}...`)).not.toBeInTheDocument();
    expect(toast.loading).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("disables sharing when the current match is already shared", () => {
    const index = loadIndex<MatchIndex>("match-index.json");
    const matchGames = loadMatchGames(index.games);
    const matchHash = computeShareContentHash(
      createShareHashInputFromMatchGames({
        userId: "user-123",
        contentType: "match",
        matchGames,
      }),
    );
    sharedGameHashesState.hashes = new Set([matchHash]);

    render(
      <ShareGameModal
        open={true}
        userId="user-123"
        username="ellipsoul"
        singleGameData={toSingleGameData(matchGames[0]!)}
        matchGames={matchGames}
        contentType="match"
        selectedPair={null}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
    expect(
      screen.getByText("You already shared this match. Switch to share a single game instead."),
    ).toBeInTheDocument();
  });

  it("allows descriptions containing the chess term 'pawn'", async () => {
    const index = loadIndex<MatchIndex>("match-index.json");
    const matchGames = loadMatchGames(index.games);
    const singleGameData = toSingleGameData(matchGames[0]!);

    render(
      <ShareGameModal
        open={true}
        userId="user-123"
        username="ellipsoul"
        singleGameData={singleGameData}
        matchGames={matchGames}
        contentType="match"
        selectedPair={null}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: "Share match" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Brilliant pawn sacrifice!" } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).not.toBeDisabled();
  });

  it("allows sharing a single game when match is already shared", async () => {
    const index = loadIndex<MatchIndex>("match-index.json");
    const matchGames = loadMatchGames(index.games);
    const singleGameData = toSingleGameData(matchGames[0]!);
    const matchHash = computeShareContentHash(
      createShareHashInputFromMatchGames({
        userId: "user-123",
        contentType: "match",
        matchGames,
      }),
    );
    const singleHash = computeShareContentHash(
      createShareHashInputFromSingleGame({ userId: "user-123", gameData: singleGameData }),
    );
    sharedGameHashesState.hashes = new Set([matchHash]);

    render(
      <ShareGameModal
        open={true}
        userId="user-123"
        username="ellipsoul"
        singleGameData={singleGameData}
        matchGames={matchGames}
        contentType="match"
        selectedPair={null}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: "Share match" }));

    expect(sharedGameHashesState.hashes.has(singleHash)).toBe(false);
    expect(screen.getByRole("button", { name: "Share" })).not.toBeDisabled();
  });
});
