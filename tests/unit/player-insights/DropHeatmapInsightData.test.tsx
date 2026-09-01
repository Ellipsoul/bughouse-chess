import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/components/player-insights/DropHeatmapInsight", () => ({
  default: ({
    data,
  }: {
    data: {
      dataset: { trackedPlayers: number; version: string };
      players: Array<{ dropsByColor: number[][][] }>;
    };
  }) => {
    const drops = data.players.reduce((playerTotal, player) => (
      playerTotal + player.dropsByColor.reduce((colorTotal, pieces) => (
        colorTotal + pieces.reduce((pieceTotal, squares) => (
          pieceTotal + squares.reduce((squareTotal, count) => squareTotal + count, 0)
        ), 0)
      ), 0)
    ), 0);
    return (
      <div
        data-testid="static-drop-heatmaps"
        data-drops={drops}
        data-player-count={data.players.length}
        data-tracked-players={data.dataset.trackedPlayers}
        data-version={data.dataset.version}
      />
    );
  },
}));

describe("checked piece-drop heat-map projection", () => {
  it("loads the full static cohort and both color channels", async () => {
    const { default: DropHeatmapInsightData } = await import(
      "@/app/components/player-insights/DropHeatmapInsightData"
    );

    render(<DropHeatmapInsightData />);

    const artifact = screen.getByTestId("static-drop-heatmaps");
    expect(Number(artifact.dataset.trackedPlayers)).toBeGreaterThan(0);
    expect(artifact.dataset.playerCount).toBe(artifact.dataset.trackedPlayers);
    expect(Number(artifact.dataset.drops)).toBeGreaterThan(0);
    expect(artifact.dataset.version).toMatch(/^[0-9a-f]{40}$/);
  });
});
