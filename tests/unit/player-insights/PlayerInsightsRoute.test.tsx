import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/components/player-insights/PlayerInsightsPageClient", () => ({
  default: ({ data }: { data: { dataset: { trackedPlayers: number; version: string } } }) => (
    <div>
      static insights: {data.dataset.trackedPlayers} / {data.dataset.version}
    </div>
  ),
}));

describe("player insights route", () => {
  it("passes the checked static cohort artifact directly to the client page", async () => {
    const { default: PlayerInsightsPage, metadata } = await import(
      "@/app/player-insights/page"
    );

    render(<PlayerInsightsPage />);

    expect(screen.getByText(/static insights: 1013/)).toHaveTextContent(
      "2b0f44c2a04fe721accfda7e98e35f56741e7dce",
    );
    expect(metadata.title).toBe("Player Insights");
  });
});
