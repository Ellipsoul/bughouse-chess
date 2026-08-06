import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import KingHeightInsight from "@/app/components/player-insights/KingHeightInsight";
import type { KingHeightInsightsData } from "@/app/components/player-insights/kingHeight";

const fixture: KingHeightInsightsData = {
  schemaVersion: 1,
  dataset: {
    version: "dataset-1",
    sourceSnapshotSha256: "a".repeat(64),
    adapterPolicy: "adapter-v1",
    kingHeightAnalyzerVersion: "king-height-v1",
    cohortPolicy: "cohort-v1",
    acceptedGames: 4000,
    analyzedGames: 4000,
    replayExcludedGames: 0,
    trackedPlayers: 3,
  },
  heightOrder: [1, 2, 3, 4, 5, 6, 7, 8],
  players: [
    {
      username: "alice",
      displayName: "Alice",
      analyzedGames: 2000,
      heights: [1000, 0, 1000, 0, 0, 0, 0, 0],
      heightEightGames: [],
    },
    {
      username: "bob",
      displayName: "Bob",
      analyzedGames: 2000,
      heights: [0, 0, 0, 0, 1999, 0, 0, 1],
      heightEightGames: [
        {
          url: "https://www.chess.com/game/live/123",
          endTime: 1700000000,
          color: "black",
        },
      ],
    },
    {
      username: "carol",
      displayName: "Carol",
      analyzedGames: 0,
      heights: [0, 0, 0, 0, 0, 0, 0, 0],
      heightEightGames: [],
    },
  ],
};

describe("Average King Height insight", () => {
  it("renders accessible distributions, reverses both sort metrics, and exposes touchdown links", () => {
    render(<KingHeightInsight data={fixture} />);

    expect(screen.getByRole("heading", { name: "Average King Height" })).toBeInTheDocument();
    const averageSort = screen.getByRole("button", { name: "Sort by Average King Height" });
    expect(averageSort).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("img", { name: /Alice king height distribution.*height 1: 50%.*height 3: 50%/i })).toBeInTheDocument();

    let rows = screen.getAllByRole("article");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Alice"),
      expect.stringContaining("Bob"),
    ]);

    fireEvent.click(averageSort);
    rows = screen.getAllByRole("article");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Bob"),
      expect.stringContaining("Alice"),
    ]);

    const touchdownSort = screen.getByRole("button", { name: "Sort by Touchdowns" });
    fireEvent.click(touchdownSort);
    expect(touchdownSort).toHaveAttribute("aria-pressed", "true");
    rows = screen.getAllByRole("article");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Bob"),
      expect.stringContaining("Alice"),
    ]);

    fireEvent.click(touchdownSort);
    rows = screen.getAllByRole("article");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Alice"),
      expect.stringContaining("Bob"),
    ]);

    const bob = rows[1];
    expect(within(bob).getByText("Touchdown")).toBeInTheDocument();
    fireEvent.click(within(bob).getByText("1 touchdown"));
    expect(within(bob).getByRole("link", { name: /14 November 2023.*Black/i })).toHaveAttribute(
      "href",
      "https://bughouse.aronteh.com/?gameId=123",
    );
    expect(within(bob).getByRole("link", { name: /14 November 2023.*Black/i })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(screen.queryByText(/crossing/i)).not.toBeInTheDocument();
  });

  it("filters by an inclusive integer-only minimum game count", () => {
    render(<KingHeightInsight data={fixture} />);

    const minimumGames = screen.getByRole("textbox", { name: "Minimum player games" });
    expect(minimumGames).toHaveValue("1000");
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.queryByText("Carol")).not.toBeInTheDocument();

    fireEvent.change(minimumGames, { target: { value: "" } });
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByText("Carol")).toBeInTheDocument();

    fireEvent.change(minimumGames, { target: { value: "2001" } });
    expect(screen.queryAllByRole("article")).toHaveLength(0);

    fireEvent.change(minimumGames, { target: { value: "2001.5" } });
    expect(minimumGames).toHaveValue("2001");

    fireEvent.change(minimumGames, { target: { value: "many" } });
    expect(minimumGames).toHaveValue("2001");
  });
});
