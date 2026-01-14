import { describe, expect, it } from "vitest";
import type { ShareEligibilityInput } from "../../../app/utils/shareEligibility";
import { getShareEligibility } from "../../../app/utils/shareEligibility";

function createInput(overrides: Partial<ShareEligibilityInput> = {}): ShareEligibilityInput {
  return {
    isFullyAuthenticated: true,
    loadedGameId: "160064848971",
    isDiscovering: false,
    sharedId: null,
    matchDiscoveryStatus: "idle",
    matchGamesCount: 0,
    hasUserInitiatedMatchDiscovery: false,
    authMessage: null,
    ...overrides,
  };
}

describe("getShareEligibility", () => {
  it("allows sharing for a loaded, authenticated non-shared game", () => {
    const result = getShareEligibility(createInput());

    expect(result).toEqual({ canShare: true });
  });

  it("blocks sharing for shared games until a full match is discovered", () => {
    const result = getShareEligibility(
      createInput({
        sharedId: "shared-123",
        matchDiscoveryStatus: "complete",
        matchGamesCount: 1,
        hasUserInitiatedMatchDiscovery: true,
      }),
    );

    expect(result.canShare).toBe(false);
    expect(result.disabledReason).toBe(
      "Find match games to share beyond the original shared game",
    );
  });

  it("allows sharing after match discovery completes for a shared game", () => {
    const result = getShareEligibility(
      createInput({
        sharedId: "shared-123",
        matchDiscoveryStatus: "complete",
        matchGamesCount: 3,
        hasUserInitiatedMatchDiscovery: true,
      }),
    );

    expect(result).toEqual({ canShare: true });
  });

  it("keeps sharing disabled for shared games before discovery is complete", () => {
    const result = getShareEligibility(
      createInput({
        sharedId: "shared-123",
        matchDiscoveryStatus: "discovering",
        matchGamesCount: 2,
        hasUserInitiatedMatchDiscovery: true,
      }),
    );

    expect(result.canShare).toBe(false);
    expect(result.disabledReason).toBe("Wait for match discovery to complete");
  });

  it("uses auth message when the user is not fully authenticated", () => {
    const result = getShareEligibility(
      createInput({
        isFullyAuthenticated: false,
        authMessage: "Sign in and set username to share",
      }),
    );

    expect(result.canShare).toBe(false);
    expect(result.disabledReason).toBe("Sign in and set username to share");
  });
});
