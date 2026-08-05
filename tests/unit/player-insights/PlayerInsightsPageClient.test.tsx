import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PlayerInsightsPageClient from "@/app/components/player-insights/PlayerInsightsPageClient";
import type { MaterialInsightsData } from "@/app/components/player-insights/leaderboard";

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

describe("PlayerInsightsPageClient", () => {
  it("renders the lifetime material leaderboard as an accessible piece ledger", () => {
    render(<PlayerInsightsPageClient data={fixture} />);

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
    render(<PlayerInsightsPageClient data={fixture} />);

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
    render(<PlayerInsightsPageClient data={fixture} />);

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
});
