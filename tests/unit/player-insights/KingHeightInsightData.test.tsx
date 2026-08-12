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
    <div>
      static king height: {data.dataset.trackedPlayers} / {data.dataset.version} / {data.players.reduce((total, player) => total + player.heightEightGames.length, 0)} touchdowns
    </div>
  ),
}));

describe("checked king-height projection", () => {
  it("loads the full static cohort and score-eight evidence", async () => {
    const { default: KingHeightInsightData } = await import(
      "@/app/components/player-insights/KingHeightInsightData"
    );

    render(<KingHeightInsightData />);

    expect(screen.getByText(/static king height: 1013/)).toHaveTextContent(
      "6d6869bc792e195644be7129ca5fb5571020aa63 / 7170 touchdowns",
    );
  });
});
