import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/components/player-insights/MaterialGameHighsInsight", () => ({
  default: ({ data, preset }: { data: { dataset: { trackedPlayers: number } }; preset: string }) => (
    <div>{preset}:{data.dataset.trackedPlayers}</div>
  ),
}));

describe("MaterialGameHighsInsightData", () => {
  it("loads the checked static projection inside the lazy insight chunk", async () => {
    const { default: MaterialGameHighsInsightData } = await import(
      "@/app/components/player-insights/MaterialGameHighsInsightData"
    );

    render(<MaterialGameHighsInsightData preset="standard" />);

    expect(screen.getByText("standard:1013")).toBeInTheDocument();
  });
});
