"use client";

import React from "react";
import { formatSignedCaptureMaterial } from "../../utils/analysis/captureMaterial";

export type BoardCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface BoardCornerMaterialProps {
  /**
   * Signed capture-material total for the player associated with this corner.
   */
  value: number;
  /**
   * Which corner of the board/player-bar this counter should occupy.
   */
  corner: BoardCorner;
  /**
   * Optional density hint for very small viewports (e.g. phone landscape).
   */
  density?: "default" | "compact";
}

function getCornerPositionClasses(corner: BoardCorner): string {
  switch (corner) {
    case "top-left":
      return "left-0 top-0";
    case "top-right":
      return "right-0 top-0";
    case "bottom-left":
      return "left-0 bottom-0";
    case "bottom-right":
      return "right-0 bottom-0";
  }
}

/**
 * Tiny, always-on capture-material indicator rendered in a board corner.
 *
 * This is intentionally small and low-contrast (relative to player names/clocks),
 * but still readable at a glance when you look for it.
 */
export function BoardCornerMaterial({ value, corner, density = "default" }: BoardCornerMaterialProps) {
  const text =
    typeof value === "number" && Number.isFinite(value) ? formatSignedCaptureMaterial(value) : "0";

  const tint =
    value > 0 ? "text-emerald-300" : value < 0 ? "text-rose-300" : "text-white/40";

  return (
    <span
      className={[
        "absolute pointer-events-none select-none font-mono tabular-nums leading-none",
        density === "compact" ? "text-[8px]" : "text-[9px]",
        tint,
        // Tiny padding so we don't visually touch the bar edges.
        "px-0.5",
        getCornerPositionClasses(corner),
      ].join(" ")}
      aria-label={`Capture material ${text}`}
    >
      {text}
    </span>
  );
}
