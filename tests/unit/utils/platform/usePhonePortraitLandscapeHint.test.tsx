import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  usePhonePortraitLandscapeHint,
  __private__PHONE_PORTRAIT_LANDSCAPE_HINT_MEDIA_QUERY,
} from "../../../../app/utils/platform/usePhonePortraitLandscapeHint";

function HintProbe() {
  const { shouldSuggestLandscape } = usePhonePortraitLandscapeHint();
  return <span data-testid="hint-state">{shouldSuggestLandscape ? "show" : "hide"}</span>;
}

/** Shared state for the portrait-hint query so every `matchMedia` call returns the same MQL. */
let portraitHintMatches = false;
const portraitHintListeners = new Set<() => void>();

function emitPortraitHintChange() {
  portraitHintListeners.forEach((listener) => {
    listener();
  });
}

describe("usePhonePortraitLandscapeHint", () => {
  beforeEach(() => {
    portraitHintMatches = false;
    portraitHintListeners.clear();

    vi.stubGlobal("matchMedia", (query: string) => {
      if (query !== __private__PHONE_PORTRAIT_LANDSCAPE_HINT_MEDIA_QUERY) {
        return {
          matches: false,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        } as unknown as MediaQueryList;
      }

      return {
        get matches() {
          return portraitHintMatches;
        },
        media: query,
        addEventListener(_type: string, listener: EventListener) {
          portraitHintListeners.add(listener as () => void);
        },
        removeEventListener(_type: string, listener: EventListener) {
          portraitHintListeners.delete(listener as () => void);
        },
      } as unknown as MediaQueryList;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts hidden when the media query does not match", () => {
    render(<HintProbe />);
    expect(screen.getByTestId("hint-state")).toHaveTextContent("hide");
  });

  it("shows when the media query matches and hides after change", async () => {
    render(<HintProbe />);

    await act(async () => {
      portraitHintMatches = true;
      emitPortraitHintChange();
    });
    expect(screen.getByTestId("hint-state")).toHaveTextContent("show");

    await act(async () => {
      portraitHintMatches = false;
      emitPortraitHintChange();
    });
    expect(screen.getByTestId("hint-state")).toHaveTextContent("hide");
  });

  it("exports the expected composed media query string", () => {
    expect(__private__PHONE_PORTRAIT_LANDSCAPE_HINT_MEDIA_QUERY).toBe(
      "(hover: none) and (pointer: coarse) and (orientation: portrait) and (max-width: 640px)",
    );
  });
});
