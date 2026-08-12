import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/components/player-insights/PlayerInsightsPageClient", () => ({
  default: ({ data }: { data: { dataset: { trackedPlayers: number; version: string } } }) => (
    <div>
      static material: {data.dataset.trackedPlayers} / {data.dataset.version}
    </div>
  ),
}));

describe("player insights route", () => {
  it("passes the checked static cohort artifact directly to the client page", async () => {
    const { default: PlayerInsightsPage, metadata } = await import(
      "@/app/player-insights/page"
    );

    render(<PlayerInsightsPage />);

    expect(screen.getByText(/static material: 1013/)).toHaveTextContent(
      "6d6869bc792e195644be7129ca5fb5571020aa63",
    );
    expect(metadata.title).toBe("Player Insights");
  });
});
