import type { MatchDiscoveryStatus } from "../types/match";

export interface ShareEligibilityInput {
  /**
   * Whether the user is fully authenticated (signed in + username set).
   */
  isFullyAuthenticated: boolean;
  /**
   * Currently loaded game ID (if any).
   */
  loadedGameId: string | null;
  /**
   * Whether match discovery is currently running.
   */
  isDiscovering: boolean;
  /**
   * Shared game ID from the URL (when loaded via shared games library).
   */
  sharedId: string | null;
  /**
   * Current match discovery status.
   */
  matchDiscoveryStatus: MatchDiscoveryStatus;
  /**
   * Total number of match games currently loaded.
   */
  matchGamesCount: number;
  /**
   * Whether the user initiated match discovery in this session.
   * Used to distinguish shared-game loads from user-triggered matches.
   */
  hasUserInitiatedMatchDiscovery: boolean;
  /**
   * Optional authentication requirement message, used when auth is incomplete.
   */
  authMessage?: string | null;
}

export interface ShareEligibilityResult {
  canShare: boolean;
  disabledReason?: string;
}

/**
 * Determines whether sharing is allowed and, if not, why.
 *
 * Business rules:
 * - Sharing requires a loaded game and full authentication.
 * - Sharing is blocked while match discovery is running.
 * - Shared games cannot be re-shared unless the user finds a full match
 *   via the "Find Match Games" flow in the current session.
 */
export function getShareEligibility({
  isFullyAuthenticated,
  loadedGameId,
  isDiscovering,
  sharedId,
  matchDiscoveryStatus,
  matchGamesCount,
  hasUserInitiatedMatchDiscovery,
  authMessage,
}: ShareEligibilityInput): ShareEligibilityResult {
  if (!loadedGameId) {
    return { canShare: false, disabledReason: "Load a game to share" };
  }

  const effectiveIsDiscovering = isDiscovering || matchDiscoveryStatus === "discovering";

  if (effectiveIsDiscovering) {
    return { canShare: false, disabledReason: "Wait for match discovery to complete" };
  }

  const hasDiscoveredMatchFromSharedGame = Boolean(
    sharedId
      && hasUserInitiatedMatchDiscovery
      && matchDiscoveryStatus === "complete"
      && matchGamesCount > 1,
  );

  if (sharedId && !hasDiscoveredMatchFromSharedGame) {
    return {
      canShare: false,
      disabledReason: "Find match games to share beyond the original shared game",
    };
  }

  if (!isFullyAuthenticated) {
    return { canShare: false, disabledReason: authMessage ?? undefined };
  }

  return { canShare: true };
}
