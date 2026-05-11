/**
 * Detects viewports where we gently suggest rotating to landscape for the game viewer.
 *
 * Heuristic (aligned with {@link useCompactLandscape}):
 * - **Coarse pointer + no hover** — primary input is touch, so we do not nag desktop users
 *   who resize the window to a tall aspect ratio.
 * - **Portrait** — the layout the viewer does not optimize for on phones.
 * - **Narrow width (`max-width: 640px`)** — targets phones; wide portrait tablets (e.g. iPad
 *   ~768px) are excluded, matching the product stance that those viewports are already usable.
 *
 * @returns `shouldSuggestLandscape` — `true` when the hint chip should be shown.
 */
import { useEffect, useState } from "react";

const PHONE_PORTRAIT_LANDSCAPE_HINT_MEDIA_QUERY =
  "(hover: none) and (pointer: coarse) and (orientation: portrait) and (max-width: 640px)";

/**
 * @returns Whether to show a non-blocking “rotate for best experience” hint.
 */
export function usePhonePortraitLandscapeHint(): { shouldSuggestLandscape: boolean } {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia(PHONE_PORTRAIT_LANDSCAPE_HINT_MEDIA_QUERY);
    const update = () => setMatches(media.matches);
    update();

    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return { shouldSuggestLandscape: matches };
}

/** @internal Exported for unit tests that assert the media query contract. */
export const __private__PHONE_PORTRAIT_LANDSCAPE_HINT_MEDIA_QUERY =
  PHONE_PORTRAIT_LANDSCAPE_HINT_MEDIA_QUERY;
