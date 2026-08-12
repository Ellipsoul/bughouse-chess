import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PlayerInsightsPageClient from "@/app/components/player-insights/PlayerInsightsPageClient";
import type { DropHeatmapInsightsData } from "@/app/components/player-insights/dropHeatmaps";
import type { KingHeightInsightsData } from "@/app/components/player-insights/kingHeight";
import type { MaterialInsightsData } from "@/app/components/player-insights/leaderboard";
import type { MaterialGameHighsData } from "@/app/components/player-insights/materialGameHighs";

vi.mock("@/app/utils/preferences/usePieceValuePreset", () => ({
  usePieceValuePreset: () => "bughouse",
}));

const fixture: MaterialInsightsData = {
  schemaVersion: 1,
  dataset: {
    version: "dataset-1",
    sourceSnapshotSha256: "a".repeat(64),
    adapterPolicy: "adapter-v1",
    analyzerVersion: "analyzer-v1",
    cohortPolicy: "cohort-v1",
    acceptedGames: 3,
    analyzedGames: 3,
    replayExcludedGames: 0,
    trackedPlayers: 3,
  },
  pieceOrder: ["pawn", "knight", "bishop", "rook", "queen"],
  pieceValues: {
    bughouse: [1.5, 3, 3, 4, 7],
    standard: [1, 3, 3, 5, 9],
  },
  players: [
    {
      username: "alice",
      displayName: "Alice",
      eligibleGames: 2,
      analyzedGames: 2,
      replayExcludedGames: 2,
      pieces: [[4, 0], [0, 0], [0, 0], [1, 0], [0, 0]],
    },
    {
      username: "bob",
      displayName: "Bob",
      eligibleGames: 1,
      analyzedGames: 1,
      replayExcludedGames: 0,
      pieces: [[0, 0], [0, 0], [0, 0], [2, 0], [0, 1]],
    },
    {
      username: "carol",
      displayName: "Carol",
      eligibleGames: 0,
      analyzedGames: 0,
      replayExcludedGames: 0,
      pieces: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    },
  ],
};

const kingHeightFixture: KingHeightInsightsData = {
  schemaVersion: 1,
  dataset: {
    version: "dataset-1",
    sourceSnapshotSha256: "a".repeat(64),
    adapterPolicy: "adapter-v1",
    kingHeightAnalyzerVersion: "king-height-v1",
    cohortPolicy: "cohort-v1",
    acceptedGames: 3,
    analyzedGames: 3,
    replayExcludedGames: 0,
    trackedPlayers: 3,
  },
  heightOrder: [1, 2, 3, 4, 5, 6, 7, 8],
  players: fixture.players.map((player) => ({
    username: player.username,
    displayName: player.displayName,
    analyzedGames: player.analyzedGames,
    heights: player.analyzedGames === 0
      ? [0, 0, 0, 0, 0, 0, 0, 0]
      : [player.analyzedGames, 0, 0, 0, 0, 0, 0, 0],
    heightEightGames: [],
  })),
};

const dropHeatmapFixture: DropHeatmapInsightsData = {
  schemaVersion: 1,
  dataset: {
    version: "dataset-1",
    sourceSnapshotSha256: "a".repeat(64),
    adapterPolicy: "adapter-v1",
    dropHeatmapAnalyzerVersion: "drop-v1",
    cohortPolicy: "cohort-v1",
    acceptedGames: 3,
    analyzedGames: 3,
    replayExcludedGames: 0,
    trackedPlayers: 3,
  },
  pieceOrder: ["pawn", "knight", "bishop", "rook", "queen"],
  squareOrder: Array.from(
    { length: 64 },
    (_, index) => `${"abcdefgh"[index % 8]}${Math.floor(index / 8) + 1}`,
  ),
  players: fixture.players.map((player) => ({
    username: player.username,
    displayName: player.displayName,
    analyzedGames: player.analyzedGames,
    analyzedGamesByColor: [player.analyzedGames, 0],
    dropsByColor: [
      Array.from({ length: 5 }, () => Array.from({ length: 64 }, () => 0)),
      Array.from({ length: 5 }, () => Array.from({ length: 64 }, () => 0)),
    ],
  })),
};

const materialGameHighsFixture: MaterialGameHighsData = {
  schemaVersion: 1,
  dataset: {
    version: "dataset-1",
    sourceSnapshotSha256: "a".repeat(64),
    adapterPolicy: "adapter-v1",
    materialGameHighsAnalyzerVersion: "game-highs-v1",
    cohortPolicy: "cohort-v1",
    acceptedGames: 3,
    analyzedGames: 3,
    replayExcludedGames: 0,
    trackedPlayers: 3,
  },
  presetOrder: ["bughouse", "standard"],
  directionOrder: ["won", "lost"],
  players: fixture.players.map((player) => ({
    username: player.username,
    displayName: player.displayName,
    analyzedGames: player.analyzedGames,
    gamesByPreset: [
      { won: [], lost: [] },
      { won: [], lost: [] },
    ],
  })),
};

describe("PlayerInsightsPageClient", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/player-insights");
  });

  it("selects a directly linked insight from the URL", async () => {
    window.history.replaceState(
      {},
      "",
      "/player-insights?insight=average-king-height",
    );

    render(
      <PlayerInsightsPageClient
        data={fixture}
        kingHeightData={kingHeightFixture}
      />,
    );

    expect(await screen.findByRole("heading", {
      name: "Average King Height",
    })).toBeInTheDocument();
    expect(screen.getByRole("button", {
      name: "Average King Height",
    })).toHaveAttribute("aria-pressed", "true");
  });

  it("updates the shareable insight parameter without discarding other parameters", async () => {
    window.history.replaceState(
      {},
      "",
      "/player-insights?campaign=discord#comparison",
    );

    render(
      <PlayerInsightsPageClient
        data={fixture}
        kingHeightData={kingHeightFixture}
        dropHeatmapData={dropHeatmapFixture}
      />,
    );

    fireEvent.click(screen.getByRole("button", {
      name: "Piece Drop Heat Maps",
    }));
    expect(await screen.findByRole("heading", {
      name: "Piece Drop Heat Maps",
    })).toBeInTheDocument();
    expect(window.location.search).toBe(
      "?campaign=discord&insight=piece-drop-heatmaps",
    );
    expect(window.location.hash).toBe("#comparison");
  });

  it("renders the lifetime material leaderboard as an accessible piece ledger", () => {
    render(<PlayerInsightsPageClient data={fixture} kingHeightData={kingHeightFixture} />);

    expect(screen.getByRole("heading", { name: "Player Insights" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Net Material" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Net Material per Game" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByText("3 permanently tracked players")).toBeInTheDocument();

    const alice = screen.getByRole("row", { name: /Alice/ });
    expect(within(alice).getByText("+10")).toBeInTheDocument();
    expect(within(alice).getByLabelText("Pawn: won 4, lost 0, net +4")).toBeInTheDocument();
    expect(within(alice).getByLabelText("Rook: won 1, lost 0, net +1")).toBeInTheDocument();
    expect(within(alice).queryByText("+2 excluded")).not.toBeInTheDocument();
  });

  it("searches, changes insight, and toggles a piece column between most won and lost", () => {
    render(<PlayerInsightsPageClient data={fixture} kingHeightData={kingHeightFixture} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search players" }), {
      target: { value: "bob" },
    });
    expect(screen.getByRole("row", { name: /Bob/ })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Alice/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search players" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Net Material per Game" }));
    const alice = screen.getByRole("row", { name: /Alice/ });
    expect(alice).toHaveTextContent("+5.00");
    expect(
      within(alice).getByLabelText(
        "Pawn per game: won 2.00, lost 0.00, net +2.00",
      ),
    ).toBeInTheDocument();

    expect(screen.queryByRole("combobox", { name: "Sort leaderboard" })).not.toBeInTheDocument();

    const queenSort = screen.getByRole("button", { name: "Sort by Queen" });
    fireEvent.click(queenSort);
    expect(screen.getByRole("columnheader", { name: /Queen/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    let rows = screen.getAllByRole("row").filter((row) => /Alice|Bob|Carol/.test(row.textContent ?? ""));
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Alice"),
      expect.stringContaining("Bob"),
      expect.stringContaining("Carol"),
    ]);

    fireEvent.click(queenSort);
    expect(screen.getByRole("columnheader", { name: /Queen/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    rows = screen.getAllByRole("row").filter((row) => /Alice|Bob|Carol/.test(row.textContent ?? ""));
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Bob"),
      expect.stringContaining("Alice"),
      expect.stringContaining("Carol"),
    ]);
  });

  it("toggles the Games column between most and fewest analyzed games", () => {
    render(<PlayerInsightsPageClient data={fixture} kingHeightData={kingHeightFixture} />);

    const gamesSort = screen.getByRole("button", { name: "Sort by Games" });
    fireEvent.click(gamesSort);
    expect(screen.getByRole("columnheader", { name: /Games/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );

    fireEvent.click(gamesSort);
    expect(screen.getByRole("columnheader", { name: /Games/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    const rows = screen.getAllByRole("row").filter((row) => /Alice|Bob|Carol/.test(row.textContent ?? ""));
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Carol"),
      expect.stringContaining("Bob"),
      expect.stringContaining("Alice"),
    ]);
  });

  it("switches to the feature-owned Average King Height renderer", () => {
    render(<PlayerInsightsPageClient data={fixture} kingHeightData={kingHeightFixture} />);

    fireEvent.click(screen.getByRole("button", { name: "Average King Height" }));

    expect(screen.getByRole("heading", { name: "Average King Height" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort by Average King Height" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByText("Measured from each back rank")).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Player material leaderboard" })).not.toBeInTheDocument();
  });

  it("switches to the feature-owned Piece Drop Heat Maps renderer", async () => {
    render(
      <PlayerInsightsPageClient
        data={fixture}
        kingHeightData={kingHeightFixture}
        dropHeatmapData={dropHeatmapFixture}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Piece Drop Heat Maps" }));

    expect(await screen.findByRole("heading", { name: "Piece Drop Heat Maps" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Combined drops" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("table", { name: "Player material leaderboard" })).not.toBeInTheDocument();
  });

  it("switches to the lazy feature-owned Material Game Highs renderer", async () => {
    render(
      <PlayerInsightsPageClient
        data={fixture}
        materialGameHighsData={materialGameHighsFixture}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Material Game Highs" }));

    expect(await screen.findByRole("heading", { name: "Material Game Highs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Most won" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(window.location.search).toBe("?insight=material-game-highs");
    expect(screen.queryByRole("table", { name: "Player material leaderboard" })).not.toBeInTheDocument();
  });
});
