"use client";

import MaterialGameHighsInsight from "@/app/components/player-insights/MaterialGameHighsInsight";
import type { MaterialGameHighsData } from "@/app/components/player-insights/materialGameHighs";
import playerMaterialGameHighs from "@/app/data/player-material-game-highs.json";
import type { PieceValuePreset } from "@/app/utils/analysis/captureMaterial";

const staticMaterialGameHighs = (
  playerMaterialGameHighs as unknown as MaterialGameHighsData
);

/** Load the checked static projection only when material game highs are selected. */
export default function MaterialGameHighsInsightData({
  preset,
}: {
  preset: PieceValuePreset;
}) {
  return <MaterialGameHighsInsight data={staticMaterialGameHighs} preset={preset} />;
}
