"use client";

import KingHeightInsight from "@/app/components/player-insights/KingHeightInsight";
import type { KingHeightInsightsData } from "@/app/components/player-insights/kingHeight";
import playerKingHeightInsights from "@/app/data/player-king-height-insights.json";

const staticKingHeightInsights = playerKingHeightInsights as unknown as KingHeightInsightsData;

/** Load the checked static projection only when the king-height insight is selected. */
export default function KingHeightInsightData() {
  return <KingHeightInsight data={staticKingHeightInsights} />;
}
