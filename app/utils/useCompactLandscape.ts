/**
 * `useCompactLandscape` identifies “phone-like landscape” viewports where we intentionally
 * trade vertical density for usability.
 *
 * Design goals:
 * - Must **not** affect iPad Mini portrait (or larger tablets) where the app is already solid.
 * - Must **not** trigger on desktop window resizes.
 *
 * We do this by requiring:
 * - touch input (`pointer: coarse`, `hover: none`)
 * - landscape orientation
 * - a small viewport height cap (phones in landscape are short, even when wide)
 */
import { useEffect, useState } from "react";

const COMPACT_LANDSCAPE_MEDIA_QUERY =
  "(hover: none) and (pointer: coarse) and (orientation: landscape) and (max-height: 500px)";

/**
 * @returns `true` when the current viewport should use the compact landscape layout.
 */
export function useCompactLandscape(): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia(COMPACT_LANDSCAPE_MEDIA_QUERY);
    const update = () => setMatches(media.matches);
    update();

    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return matches;
}

export const __private__COMPACT_LANDSCAPE_MEDIA_QUERY = COMPACT_LANDSCAPE_MEDIA_QUERY;


