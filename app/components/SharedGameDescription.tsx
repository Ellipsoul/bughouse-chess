import React from "react";

export type SharedGameDescriptionDensity = "default" | "compact";

export interface SharedGameDescriptionProps {
  /**
   * The description text provided by the sharer.
   * This component renders nothing when the description is empty or whitespace.
   */
  description: string;
  /**
   * Visual density for tighter layouts (e.g. phone landscape).
   * Use "compact" to reduce font size and padding.
   */
  density?: SharedGameDescriptionDensity;
}

/**
 * Renders a compact, pill-like description for shared games/matches.
 * Keeps typography intentionally small to fit within dense control bars.
 */
export default function SharedGameDescription({
  description,
  density = "default",
}: SharedGameDescriptionProps) {
  const trimmed = description.trim();
  if (!trimmed) return null;

  return (
    <div
      className={[
        "w-full text-gray-300 text-left",
        density === "compact"
          ? "px-1 text-[5px] sm:text-[7px] md:text-xs"
          : "px-2 text-[5px] sm:text-xs",
        "leading-snug line-clamp-2",
      ].join(" ")}
      aria-label="Shared game description"
      data-testid="shared-game-description"
    >
      {trimmed}
    </div>
  );
}
