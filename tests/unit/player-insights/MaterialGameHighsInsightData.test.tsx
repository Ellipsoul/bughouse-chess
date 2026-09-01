import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/components/player-insights/MaterialGameHighsInsight", () => ({
  default: ({
    data,
    preset,
  }: {
    data: {
      dataset: { trackedPlayers: number; version: string };
      players: unknown[];
    };
    preset: string;
  }) => (
    <div
      data-testid="static-material-game-highs"
      data-player-count={data.players.length}
      data-preset={preset}
      data-tracked-players={data.dataset.trackedPlayers}
      data-version={data.dataset.version}
    />
  ),
}));

describe("MaterialGameHighsInsightData", () => {
  it("loads the checked static projection inside the lazy insight chunk", async () => {
    const { default: MaterialGameHighsInsightData } = await import(
      "@/app/components/player-insights/MaterialGameHighsInsightData"
    );

    render(<MaterialGameHighsInsightData preset="standard" />);

    const artifact = screen.getByTestId("static-material-game-highs");
    expect(artifact.dataset.preset).toBe("standard");
    expect(Number(artifact.dataset.trackedPlayers)).toBeGreaterThan(0);
    expect(artifact.dataset.playerCount).toBe(artifact.dataset.trackedPlayers);
    expect(artifact.dataset.version).toMatch(/^[0-9a-f]{40}$/);
  });
});
