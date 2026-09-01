import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/components/player-insights/KingHeightInsight", () => ({
  default: ({
    data,
  }: {
    data: {
      dataset: { trackedPlayers: number; version: string };
      players: Array<{ heightEightGames: unknown[] }>;
    };
  }) => (
    <div
      data-testid="static-king-height"
      data-player-count={data.players.length}
      data-tracked-players={data.dataset.trackedPlayers}
      data-touchdowns={data.players.reduce((total, player) => total + player.heightEightGames.length, 0)}
      data-version={data.dataset.version}
    />
  ),
}));

describe("checked king-height projection", () => {
  it("loads the full static cohort and score-eight evidence", async () => {
    const { default: KingHeightInsightData } = await import(
      "@/app/components/player-insights/KingHeightInsightData"
    );

    render(<KingHeightInsightData />);

    const artifact = screen.getByTestId("static-king-height");
    expect(Number(artifact.dataset.trackedPlayers)).toBeGreaterThan(0);
    expect(artifact.dataset.playerCount).toBe(artifact.dataset.trackedPlayers);
    expect(Number(artifact.dataset.touchdowns)).toBeGreaterThan(0);
    expect(artifact.dataset.version).toMatch(/^[0-9a-f]{40}$/);
  });
});
