import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DropHeatmapInsight from "@/app/components/player-insights/DropHeatmapInsight";
import type { DropHeatmapInsightsData } from "@/app/components/player-insights/dropHeatmaps";

const emptySquares = () => Array.from({ length: 64 }, () => 0);

const fixture: DropHeatmapInsightsData = {
  schemaVersion: 1,
  dataset: {
    version: "dataset-1",
    sourceSnapshotSha256: "a".repeat(64),
    adapterPolicy: "adapter-v1",
    dropHeatmapAnalyzerVersion: "drop-v1",
    cohortPolicy: "cohort-v1",
    acceptedGames: 12,
    analyzedGames: 12,
    replayExcludedGames: 0,
    trackedPlayers: 2,
  },
  pieceOrder: ["pawn", "knight", "bishop", "rook", "queen"],
  squareOrder: Array.from(
    { length: 64 },
    (_, index) => `${"abcdefgh"[index % 8]}${Math.floor(index / 8) + 1}`,
  ),
  players: [
    {
      username: "alice",
      displayName: "Alice",
      analyzedGames: 10,
      analyzedGamesByColor: [6, 5],
      dropsByColor: [
        [emptySquares(), [3, 1, ...emptySquares().slice(2)], emptySquares(), emptySquares(), emptySquares()],
        [emptySquares(), [...emptySquares().slice(0, 56), 2, ...emptySquares().slice(57)], emptySquares(), emptySquares(), emptySquares()],
      ],
    },
    {
      username: "bob",
      displayName: "Bob",
      analyzedGames: 2,
      analyzedGamesByColor: [1, 1],
      dropsByColor: [
        [emptySquares(), emptySquares(), emptySquares(), emptySquares(), emptySquares()],
        [emptySquares(), emptySquares(), emptySquares(), emptySquares(), emptySquares()],
      ],
    },
  ],
};

describe("Piece Drop Heat Maps insight", () => {
  it("switches color channels and builds a top-down multi-player comparison", () => {
    render(<DropHeatmapInsight data={fixture} />);

    expect(screen.getByRole("heading", { name: "Piece Drop Heat Maps" })).toBeInTheDocument();
    const alice = screen.getAllByRole("article")[0];
    expect(within(alice).getByText("10 games")).toBeInTheDocument();
    expect(within(alice).getAllByRole("grid")).toHaveLength(5);
    const knightBoard = within(alice).getByRole("grid", { name: "Alice Knight drop heat map" });
    expect(within(knightBoard).getByRole("gridcell", { name: "a1: 5 drops, 83.33%" })).toBeInTheDocument();
    expect(within(knightBoard).getByRole("gridcell", { name: "b1: 1 drop, 16.67%" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Black drops" }));
    const blackAlice = screen.getAllByRole("article")[0];
    expect(within(blackAlice).getByText("5 games")).toBeInTheDocument();
    const blackKnightBoard = within(blackAlice).getByRole("grid", { name: "Alice Knight drop heat map" });
    expect(within(blackKnightBoard).getByRole("gridcell", { name: "a8: 2 drops, 100%" })).toBeInTheDocument();
    expect(within(blackKnightBoard).getAllByRole("gridcell")[0]).toHaveAccessibleName(
      "a8: 2 drops, 100%",
    );
    expect(screen.queryByText("Count and share of this piece’s drops")).not.toBeInTheDocument();

    const playerSelect = screen.getByRole("combobox", { name: "Add players to comparison" });
    fireEvent.change(playerSelect, { target: { value: "ali" } });
    fireEvent.click(screen.getByRole("option", { name: /Alice/ }));
    fireEvent.change(playerSelect, { target: { value: "bob" } });
    fireEvent.click(screen.getByRole("option", { name: /Bob/ }));

    const comparison = screen.getByRole("region", { name: "Selected player drop comparison" });
    const knightComparison = within(comparison).getByRole("group", { name: "Knight comparisons" });
    expect(within(knightComparison).getAllByRole("grid").map((board) => board.getAttribute("aria-label"))).toEqual([
      "Alice Knight drop heat map",
      "Bob Knight drop heat map",
    ]);
    expect(screen.getByRole("button", { name: "Remove Alice from comparison" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Bob from comparison" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove Alice from comparison" }));
    expect(screen.queryByRole("button", { name: "Remove Alice from comparison" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Bob from comparison" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Combined drops" }));
    expect(screen.getByRole("button", { name: "Combined drops" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("filters the browse list while searching for players to add", () => {
    render(<DropHeatmapInsight data={fixture} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Add players to comparison" }), {
      target: { value: "bob" },
    });
    const rows = screen.getAllByRole("article");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  it("adds the highlighted suggestion with ArrowDown and Enter", () => {
    render(<DropHeatmapInsight data={fixture} />);

    const playerSelect = screen.getByRole("combobox", {
      name: "Add players to comparison",
    });
    fireEvent.change(playerSelect, { target: { value: "ali" } });
    fireEvent.keyDown(playerSelect, { key: "ArrowDown" });

    expect(playerSelect).toHaveAttribute(
      "aria-activedescendant",
      "drop-player-suggestion-0",
    );

    fireEvent.keyDown(playerSelect, { key: "Enter" });

    expect(playerSelect).toHaveValue("");
    expect(screen.getByRole("button", {
      name: "Remove Alice from comparison",
    })).toBeInTheDocument();
  });
});
