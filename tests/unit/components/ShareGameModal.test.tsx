import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";
import type { ChessGame } from "../../../app/actions";
import type { MatchGame, PartnerPair } from "../../../app/types/match";
import type { SingleGameData } from "../../../app/types/sharedGame";
import ShareGameModal from "../../../app/components/shared/ShareGameModal";
import { shareGame, shareMatch } from "../../../app/utils/sharedGamesService";
import { revalidateSharedGamesPage } from "../../../app/actions";
import {
  computeShareContentHash,
  createShareHashInputFromMatchGames,
  createShareHashInputFromSingleGame,
} from "../../../app/utils/sharedGameHash";
import React from "react";

const sharedGameHashesState = vi.hoisted(() => ({
  hashes: new Set<string>(),
  status: "loaded" as const,
  addHash: vi.fn(),
}));

vi.mock("../../../app/utils/sharedGamesService", () => ({
  shareGame: vi.fn(),
  shareMatch: vi.fn(),
}));

vi.mock("../../../app/actions", () => ({
  revalidateSharedGamesPage: vi.fn(),
}));

vi.mock("../../../app/utils/useFirebaseAnalytics", () => ({
  useFirebaseAnalytics: () => ({ logEvent: vi.fn() }),
  logAnalyticsEvent: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../app/utils/sharedGameHashesStore", () => ({
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

function loadFixture(filename: string): ChessGame {
  return JSON.parse(
    readFileSync(join(process.cwd(), "tests", "fixtures", "chesscom", filename), "utf-8"),
  ) as ChessGame;
}

function loadIndex<T>(filename: string): T {
  return JSON.parse(
    readFileSync(join(process.cwd(), "tests", "fixtures", "chesscom", filename), "utf-8"),
  ) as T;
}

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

function toSingleGameData(matchGame: MatchGame): SingleGameData {
  return {
    original: matchGame.original,
    partner: matchGame.partner,
    partnerId: matchGame.partnerGameId,
  };
}

describe("ShareGameModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(shareGame).mockResolvedValue({ success: true, sharedId: "shared-game-1" });
    vi.mocked(shareMatch).mockResolvedValue({ success: true, sharedId: "shared-match-1" });
    vi.mocked(revalidateSharedGamesPage).mockResolvedValue(undefined);
    sharedGameHashesState.hashes = new Set();
  });

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
      );
    });
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
