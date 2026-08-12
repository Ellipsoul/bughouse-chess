import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MaterialGameHighsInsight from "@/app/components/player-insights/MaterialGameHighsInsight";
import type { MaterialGameHighsData } from "@/app/components/player-insights/materialGameHighs";

const high = (
  netMaterialX2: number,
  id: number,
  color: "white" | "black" = "white",
) => ({
  url: `https://www.chess.com/game/live/${id}`,
  endTime: 1_700_000_000,
  color,
  fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -",
  netMaterialX2,
});

const fixture: MaterialGameHighsData = {
  schemaVersion: 1,
  dataset: {
    version: "dataset-1",
    sourceSnapshotSha256: "a".repeat(64),
    adapterPolicy: "adapter-v1",
    materialGameHighsAnalyzerVersion: "game-highs-v1",
    cohortPolicy: "cohort-v1",
    acceptedGames: 10,
    analyzedGames: 10,
    replayExcludedGames: 0,
    trackedPlayers: 3,
  },
  presetOrder: ["bughouse", "standard"],
  directionOrder: ["won", "lost"],
  players: [
    {
      username: "alice",
      displayName: "Alice",
      analyzedGames: 8,
      gamesByPreset: [
        { won: [high(20, 111), high(14, 112), high(10, 113)], lost: [high(-6, 114)] },
        { won: [high(16, 111)], lost: [high(-18, 114)] },
      ],
    },
    {
      username: "bob",
      displayName: "Bob",
      analyzedGames: 4,
      gamesByPreset: [
        { won: [high(12, 211, "black")], lost: [high(-22, 212, "black")] },
        { won: [high(24, 211, "black")], lost: [high(-12, 212, "black")] },
      ],
    },
    {
      username: "carol",
      displayName: "Carol",
      analyzedGames: 0,
      gamesByPreset: [
        { won: [], lost: [] },
        { won: [], lost: [] },
      ],
    },
  ],
};

describe("Material Game Highs insight", () => {
  it("shows three final positions, Relay links, and signed direction ranking", () => {
    render(<MaterialGameHighsInsight data={fixture} preset="bughouse" />);

    expect(screen.getByRole("heading", { name: "Material Game Highs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Most won" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    let rows = screen.getAllByRole("article");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Alice"),
      expect.stringContaining("Bob"),
      expect.stringContaining("Carol"),
    ]);

    const alice = rows[0];
    expect(within(alice).getAllByRole("img", { name: /final position/i })).toHaveLength(3);
    expect(alice.querySelector('[data-piece="wK"]')).not.toBeNull();
    expect(within(alice).getByText("+10")).toBeInTheDocument();
    expect(within(alice).getByRole("link", { name: /Open #1 in Relay/i })).toHaveAttribute(
      "href",
      "https://bughouse.aronteh.com/?gameId=111",
    );
    expect(within(alice).getByRole("link", { name: /Open #1 in Relay/i })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(within(rows[2]).getByText("No qualifying game")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Most lost" }));
    rows = screen.getAllByRole("article");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Bob"),
      expect.stringContaining("Alice"),
      expect.stringContaining("Carol"),
    ]);
    expect(within(rows[0]).getByText("−11")).toBeInTheDocument();
  });

  it("searches and applies an inclusive non-negative minimum game filter", () => {
    render(<MaterialGameHighsInsight data={fixture} preset="bughouse" />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search game-high players" }), {
      target: { value: "bo" },
    });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("Bob")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search game-high players" }), {
      target: { value: "" },
    });
    const minimumGames = screen.getByRole("textbox", { name: "Minimum analyzed games" });
    expect(minimumGames).toHaveValue("0");
    fireEvent.change(minimumGames, { target: { value: "5" } });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("Alice")).toBeInTheDocument();

    fireEvent.change(minimumGames, { target: { value: "5.5" } });
    expect(minimumGames).toHaveValue("5");
    fireEvent.change(minimumGames, { target: { value: "many" } });
    expect(minimumGames).toHaveValue("5");
  });
});
