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
      <div>
        static drop heat maps: {data.dataset.trackedPlayers} / {data.dataset.version} / {drops} drops
      </div>
    );
  },
}));

describe("checked piece-drop heat-map projection", () => {
  it("loads the full static cohort and both color channels", async () => {
    const { default: DropHeatmapInsightData } = await import(
      "@/app/components/player-insights/DropHeatmapInsightData"
    );

    render(<DropHeatmapInsightData />);

    expect(screen.getByText(/static drop heat maps: 1013/)).toHaveTextContent(
      "2133356ea2a468c93ef084d65b7ec760b3c0b4a2 / 48454388 drops",
    );
  });
});
