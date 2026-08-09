"use client";

import DropHeatmapInsight from "@/app/components/player-insights/DropHeatmapInsight";
import type { DropHeatmapInsightsData } from "@/app/components/player-insights/dropHeatmaps";
import playerDropHeatmapInsights from "@/app/data/player-drop-heatmap-insights.json";

const staticDropHeatmapInsights = (
  playerDropHeatmapInsights as unknown as DropHeatmapInsightsData
);

/** Load the checked static projection only when piece drop heat maps are selected. */
export default function DropHeatmapInsightData() {
  return <DropHeatmapInsight data={staticDropHeatmapInsights} />;
}
