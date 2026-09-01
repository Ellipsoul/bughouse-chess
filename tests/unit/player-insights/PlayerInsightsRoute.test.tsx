import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/components/player-insights/PlayerInsightsPageClient", () => ({
  default: ({
    data,
  }: {
    data: {
      dataset: { trackedPlayers: number; version: string };
      players: unknown[];
    };
  }) => (
    <div
      data-testid="static-material"
      data-player-count={data.players.length}
      data-tracked-players={data.dataset.trackedPlayers}
      data-version={data.dataset.version}
    />
  ),
}));

describe("player insights route", () => {
  it("passes the checked static cohort artifact directly to the client page", async () => {
    const { default: PlayerInsightsPage, metadata } = await import(
      "@/app/player-insights/page"
    );

    render(<PlayerInsightsPage />);

    const artifact = screen.getByTestId("static-material");
    expect(Number(artifact.dataset.trackedPlayers)).toBeGreaterThan(0);
    expect(artifact.dataset.playerCount).toBe(artifact.dataset.trackedPlayers);
    expect(artifact.dataset.version).toMatch(/^[0-9a-f]{40}$/);
    expect(metadata.title).toBe("Player Insights");
  });
});
