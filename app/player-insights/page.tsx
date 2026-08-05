import type { Metadata } from "next";

import PlayerInsightsPageClient from "@/app/components/player-insights/PlayerInsightsPageClient";
import type { MaterialInsightsData } from "@/app/components/player-insights/leaderboard";
import playerMaterialInsights from "@/app/data/player-material-insights.json";

export const metadata: Metadata = {
  title: "Player Insights",
  description: "Search and compare lifetime material results across tracked Bughouse players.",
};

const staticInsights = playerMaterialInsights as unknown as MaterialInsightsData;

/** Render the checked, build-time player-insights artifact without a runtime API. */
export default function PlayerInsightsPage() {
  return <PlayerInsightsPageClient data={staticInsights} />;
}
