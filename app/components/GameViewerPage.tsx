"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import toast from "react-hot-toast";
import {
  ChessGame,
  fetchChessGame,
  findPartnerGameId,
} from "../actions";
import BughouseAnalysis from "./BughouseAnalysis";
import { APP_TOOLTIP_ID } from "../utils/tooltips";
import Link from "next/link";
import { Share } from "lucide-react";
import { getNonBughouseGameErrorMessage } from "../utils/chesscomGameValidation";
import {
  GameLoadCounterFloating,
  useGameLoadCounterLabel,
} from "./GameLoadCounterBadge";
import { useFirebaseAnalytics, logAnalyticsEvent } from "../utils/useFirebaseAnalytics";
import { getRandomSampleGameId } from "../utils/sampleGameIds";
import ConfirmLoadNewGameModal from "./ConfirmLoadNewGameModal";
import {
  setSkipLoadGameOverrideConfirm,
  shouldSkipLoadGameOverrideConfirm,
} from "../utils/loadGameOverrideConfirmPreference";
import MatchNavigation from "./MatchNavigation";
import MatchDiscoveryModeModal, {
  type DiscoveryModeSelection,
} from "./MatchDiscoveryModeModal";
import type { MatchGame, MatchDiscoveryStatus, PartnerPair } from "../types/match";
import { extractPartnerPairs } from "../types/match";
import {
  discoverMatchGames,
  createMatchGameFromLoaded,
  DiscoveryCancellation,
} from "../utils/matchDiscovery";
import { useCompactLandscape } from "../utils/useCompactLandscape";
import type { PairKey } from "../utils/matchBoardOrientation";
import {
  computeBaseFlip,
  computeEffectiveFlip,
  getBottomPairKeyForGame,
} from "../utils/matchBoardOrientation";
import { getSharedMatchBaselineBottomPairKey } from "../utils/sharedGameOrientation";
import { useFullAuth, getFullAuthRequirementMessage } from "../utils/useFullAuth";
import ShareGameModal from "./ShareGameModal";
import type { SharedContentType, SingleGameData } from "../types/sharedGame";
import { fromMatchGameData } from "../types/sharedGame";
import { getSharedGame, reconstructPartnerPairFromMetadata } from "../utils/sharedGamesService";
import { getShareEligibility } from "../utils/shareEligibility";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();

    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

/**
 * Sanitizes a "game id" input value that may be either a raw chess.com game id
 * or a full URL (or any other string containing `/` path segments).
 *
 * Per chess.com examples like `https://www.chess.com/game/live/160407448121`,
 * we extract **everything after the last slash (`/`)**.
 *
 * We also defensively strip query/hash fragments and trailing slashes to avoid
 * common copy/paste artifacts like:
 * - `https://www.chess.com/game/live/160407448121?foo=bar`
 * - `https://www.chess.com/game/live/160407448121/`
 */
function sanitizeChessComGameIdInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  // Remove `?query` / `#hash` fragments (not part of the game id).
  const withoutQueryOrHash = trimmed.split(/[?#]/, 1)[0] ?? "";
  const withoutTrailingSlashes = withoutQueryOrHash.replace(/\/+$/g, "");

  const lastSlashIdx = withoutTrailingSlashes.lastIndexOf("/");
  if (lastSlashIdx === -1) return withoutTrailingSlashes;
  return withoutTrailingSlashes.slice(lastSlashIdx + 1);
}

/**
 * Validates that a game ID matches the expected Chess.com format.
 * Chess.com game IDs are 10, 11, or 12-digit numeric values.
 *
 * @param gameId - The game ID string to validate
 * @returns `true` if the game ID is valid, `false` otherwise
 */
function isValidChessComGameId(gameId: string): boolean {
  // Chess.com game IDs must be 10, 11, or 12 digits
  return /^\d{10,12}$/.test(gameId);
}

/**
 * Human-friendly message for the "game not available" case.
 * This happens for non-existent IDs and for games that are still in progress.
 */
function buildNoGameFoundMessage(gameId: string): string {
  return `No game found with ID ${gameId}. The game may not exist or may still be in progress.`;
}

type PrefetchedGameLoad =
  | { status: "idle" }
  | { status: "invalid"; sanitizedId: string; message: string }
  | { status: "loading"; sanitizedId: string }
  | {
      status: "ready";
      sanitizedId: string;
      data: { original: ChessGame; partner: ChessGame | null; partnerId: string | null };
    }
  | { status: "error"; sanitizedId: string; message: string };

type PendingLoadGameRequest = {
  sanitizedId: string;
  clearInput: boolean;
  existingLabel: string;
};

function normalizeLoadGameErrorMessage(params: { err: unknown; sanitizedId: string }): string {
  const { err, sanitizedId } = params;

  if (!(err instanceof Error)) return "Failed to load game";

  // Next.js can surface server-action failures as opaque server-component errors.
  // In practice, the most common user-visible cause is "game not found / not ready yet".
  const message = err.message;
  if (
    message.includes("Server Component") ||
    message.includes("server component") ||
    message.includes("use server")
  ) {
    return buildNoGameFoundMessage(sanitizedId);
  }

  return message;
}

/**
 * Top-level viewer page: loads bughouse games from chess.com and renders the replay UI.
 */
export default function GameViewerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryGameId = searchParams.get("gameid") ?? searchParams.get("gameId");
  const sharedId = searchParams.get("sharedId");
  const autoLoadGameId = queryGameId?.trim();
  /**
   * Randomly select a sample game ID from available fixtures to provide variety
   * for users visiting without a specific game ID.
   */
  const defaultSampleGameId = getRandomSampleGameId();
  const shouldSeedWithSample = !autoLoadGameId && !sharedId;

  /**
   * Seed the input with a sample game only when no path/query ID preloads data.
   * When a game is already being auto-loaded from the URL, keep the input empty
   * so we do not repopulate the sample ID unnecessarily.
   */
  const [gameId, setGameId] = useState(
    shouldSeedWithSample ? defaultSampleGameId : "",
  );
  const [gameData, setGameData] = useState<
    {
      original: ChessGame;
      partner: ChessGame | null;
      partnerId: string | null;
    } | null
  >(null);
  const [isPending, startTransition] = useTransition();
  const loadedGameId = gameData?.original?.game?.id?.toString();
  const lastAutoLoadedIdRef = useRef<string | null>(null);
  const lastAutoLoadedSharedIdRef = useRef<string | null>(null);
  const [analysisIsDirty, setAnalysisIsDirty] = useState(false);
  const isDesktopLayout = useMediaQuery("(min-width: 1400px)");
  const isCompactLandscape = useCompactLandscape();
  const { label: gamesLoadedLabel } = useGameLoadCounterLabel(loadedGameId);
  const analytics = useFirebaseAnalytics();
  const [prefetched, setPrefetched] = useState<PrefetchedGameLoad>({ status: "idle" });
  const prefetchedRef = useRef(prefetched);
  const prefetchSeqRef = useRef(0);
  const prefetchDebounceTimeoutRef = useRef<number | null>(null);
  const didPrefetchSeededSampleRef = useRef(false);
  const [pendingLoadRequest, setPendingLoadRequest] = useState<PendingLoadGameRequest | null>(
    null,
  );

  // Match replay state
  const [matchGames, setMatchGames] = useState<MatchGame[]>([]);
  const [matchCurrentIndex, setMatchCurrentIndex] = useState(0);
  const [matchDiscoveryStatus, setMatchDiscoveryStatus] = useState<MatchDiscoveryStatus>("idle");
  const discoveryCancellationRef = useRef<DiscoveryCancellation | null>(null);
  const [hasUserInitiatedMatchDiscovery, setHasUserInitiatedMatchDiscovery] = useState(false);

  // Match discovery modal state
  const [isDiscoveryModalOpen, setIsDiscoveryModalOpen] = useState(false);
  /** Selected partner pair for displaying in the dropdown (tracks which pair was searched). */
  const [selectedPairForDisplay, setSelectedPairForDisplay] = useState<PartnerPair | null>(null);

  /**
   * Match-scoped board orientation state.
   *
   * We keep this state in the page shell (not inside `BughouseAnalysis`) because the analysis
   * component is intentionally remounted when switching games. This lets us preserve the user's
   * viewing perspective across games in the same match/series.
   *
   * - `baselineBottomPairKey`: the partner pair we want to keep on the bottom by default
   *   (either the selected partner pair, or the initially-viewed bottom team in full-match mode).
   * - `userFlipPreference`: whether the user wants to invert the baseline (i.e., watch from the
   *   opposite perspective). This is independent from per-game color swaps.
   */
  const [baselineBottomPairKey, setBaselineBottomPairKey] = useState<PairKey | null>(null);
  const [userFlipPreference, setUserFlipPreference] = useState(false);
  /**
   * Before a match is discovered, we still allow the user to flip the currently loaded game.
   * Once a match is discovered, the effective flip becomes `baseFlip XOR userFlipPreference`.
   *
   * We reset this on any fresh game load (not on in-match navigation).
   */
  const [standaloneBoardsFlipped, setStandaloneBoardsFlipped] = useState(false);

  // Full auth state for sharing functionality
  const { status: fullAuthStatus, user, username, isFullyAuthenticated } = useFullAuth();

  // Share modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  /**
   * Pristine game data for sharing.
   * This is set when a game is first loaded and never modified,
   * ensuring we share the original mainline regardless of user analysis.
   */
  const [pristineGameData, setPristineGameData] = useState<SingleGameData | null>(null);

  /**
   * The canonical public base URL we want users to share (rather than a localhost/dev URL).
   * Keep this in sync with deployment.
   */
  const SHARE_BASE_URL = "https://bughouse.aronteh.com/";

  /**
   * Copies text to the user's clipboard with a modern API when available, and a safe
   * fallback for older browsers / restricted contexts.
   */
  const copyToClipboard = useCallback(async (text: string) => {
    if (typeof window === "undefined") return false;

    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback: temporarily inject a textarea for execCommand("copy").
      try {
        const el = document.createElement("textarea");
        el.value = text;
        el.setAttribute("readonly", "true");
        el.style.position = "fixed";
        el.style.top = "-9999px";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(el);
        return ok;
      } catch {
        return false;
      }
    }
  }, []);

  const handleCopyShareLink = useCallback(async () => {
    if (!loadedGameId) {
      toast.error("No game loaded to share yet");
      return;
    }

    const url = new URL(SHARE_BASE_URL);
    url.searchParams.set("gameId", loadedGameId);

    const ok = await copyToClipboard(url.toString());
    if (!ok) {
      toast.error("Failed to copy link");
      return;
    }

    toast.success("Game URL copied to clipboard!");
  }, [SHARE_BASE_URL, copyToClipboard, loadedGameId]);

  const performLoadGame = useCallback(
    (trimmedId: string, clearInput: boolean) => {
      startTransition(() => {
        const prefetchedReadyForId =
          prefetched.status === "ready" && prefetched.sanitizedId === trimmedId
            ? prefetched.data
            : null;

        const loadPromise = prefetchedReadyForId
          ? Promise.resolve(prefetchedReadyForId)
          : (async () => {
              const originalGame = await fetchChessGame(trimmedId);
              if (!originalGame) {
                // Throw on the client (not from the server action) to avoid opaque Next.js
                // server-component errors surfacing in toasts.
                throw new Error(buildNoGameFoundMessage(trimmedId));
              }

              const nonBughouseError = getNonBughouseGameErrorMessage(originalGame);
              if (nonBughouseError) {
                throw new Error(nonBughouseError);
              }

              const partnerId = await findPartnerGameId(trimmedId);
              const partnerGame = partnerId ? await fetchChessGame(partnerId) : null;

              return {
                original: originalGame,
                partner: partnerGame,
                partnerId,
              };
            })();

        toast.promise(loadPromise, {
          loading: `Loading game ${trimmedId}...`,
          success: (data) =>
            data.partnerId
              ? `Successfully loaded game ${trimmedId} with partner game ${data.partnerId}`
              : `Successfully loaded game ${trimmedId}`,
          error: (err: unknown) => {
            return normalizeLoadGameErrorMessage({ err, sanitizedId: trimmedId });
          },
        });

        loadPromise
          .then((data) => {
            // Log analytics for successful game load
            logAnalyticsEvent(analytics, "game_loaded_success", {
              game_id: trimmedId,
              has_partner: data.partnerId ? "true" : "false",
              partner_id: data.partnerId ?? "none",
            });

            setGameData(data);
            setGameId(clearInput ? "" : trimmedId);
            if (clearInput) {
              setPrefetched({ status: "idle" });
            }
            // Store pristine game data for potential sharing
            setPristineGameData({
              original: data.original,
              partner: data.partner,
              partnerId: data.partnerId,
            });
            // Reset match state when loading a new game
            if (discoveryCancellationRef.current) {
              discoveryCancellationRef.current.cancel();
              discoveryCancellationRef.current = null;
            }
            setMatchGames([]);
            setMatchCurrentIndex(0);
            setMatchDiscoveryStatus("idle");
            setHasUserInitiatedMatchDiscovery(false);
            setSelectedPairForDisplay(null);
            setBaselineBottomPairKey(null);
            setUserFlipPreference(false);
            setStandaloneBoardsFlipped(false);
            // Remove sharedId from URL when loading a new game (enables sharing)
            if (sharedId) {
              const newSearchParams = new URLSearchParams(searchParams.toString());
              newSearchParams.delete("sharedId");
              const newUrl = `${window.location.pathname}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ""}`;
              router.replace(newUrl, { scroll: false });
            }
          })
          .catch((err: unknown) => {
            // Log analytics for game load error
            const errorMessage = normalizeLoadGameErrorMessage({ err, sanitizedId: trimmedId });
            logAnalyticsEvent(analytics, "game_load_error", {
              game_id: trimmedId,
              error_type: err instanceof Error ? err.message.split(":")[0] ?? "unknown" : "unknown",
            });

            // `toast.promise` already displays the error; avoid rendering an inline banner
            // that would shift the board layout.
            toast.error(errorMessage);
          });
      });
    },
    [prefetched, startTransition, router, sharedId, searchParams, analytics],
  );

  /**
   * Fetches the primary game (and partner game when available) then updates UI state.
   */
  const loadGame = useCallback(
    async (
      requestedGameId: string,
      options: { skipConfirm?: boolean; clearInput?: boolean } = {},
    ) => {
      const { skipConfirm = false, clearInput = true } = options;
      const trimmedId = sanitizeChessComGameIdInput(requestedGameId);

      if (!trimmedId) {
        toast.error("Game ID is required");
        return;
      }

      if (!isValidChessComGameId(trimmedId)) {
        toast.error("Invalid game ID. Chess.com game IDs must be 10, 11, or 12 digits.");
        return;
      }

      const existingLabel = loadedGameId ? `Game ${loadedGameId}` : "Your current analysis";

      const userHasOptedOut = (() => {
        if (typeof window === "undefined") return false;
        try {
          return shouldSkipLoadGameOverrideConfirm(window.localStorage);
        } catch {
          // If localStorage is unavailable (privacy mode / denied access), fall back to showing.
          return false;
        }
      })();

      if (!skipConfirm && (analysisIsDirty || loadedGameId) && !userHasOptedOut) {
        setPendingLoadRequest({ sanitizedId: trimmedId, clearInput, existingLabel });
        return;
      }

      performLoadGame(trimmedId, clearInput);
    },
    [analysisIsDirty, loadedGameId, performLoadGame],
  );

  const handleConfirmLoadNewGame = useCallback(
    ({ dontShowAgain }: { dontShowAgain: boolean }) => {
      const req = pendingLoadRequest;
      if (!req) return;

      if (dontShowAgain && typeof window !== "undefined") {
        try {
          setSkipLoadGameOverrideConfirm(window.localStorage, true);
        } catch {
          // If storage fails, still proceed with load; we just won't persist the preference.
        }
      }

      setPendingLoadRequest(null);
      performLoadGame(req.sanitizedId, req.clearInput);
    },
    [pendingLoadRequest, performLoadGame],
  );

  const handleCancelLoadNewGame = useCallback(() => {
    setPendingLoadRequest(null);
  }, []);

  /**
   * Opens the match discovery mode selection modal.
   * The user can then choose between full match or partner pair discovery.
   */
  const handleFindMatchGames = useCallback(() => {
    if (!gameData) {
      toast.error("No game loaded. Load a game first to find match games.");
      return;
    }
    logAnalyticsEvent(analytics, "match_discovery_initiated", {
      game_id: loadedGameId ?? "unknown",
    });
    setIsDiscoveryModalOpen(true);
  }, [gameData, analytics, loadedGameId]);

  /**
   * Handles the discovery mode selection from the modal.
   * Initiates the appropriate discovery based on user's choice.
   */
  const handleDiscoveryModeSelect = useCallback(
    (selection: DiscoveryModeSelection) => {
      setIsDiscoveryModalOpen(false);

      if (!gameData) return;

      // Cancel any existing discovery
      if (discoveryCancellationRef.current) {
        discoveryCancellationRef.current.cancel();
      }

      const cancellation = new DiscoveryCancellation();
      discoveryCancellationRef.current = cancellation;

      // Create initial match game from currently loaded data
      const initialMatchGame = createMatchGameFromLoaded(
        gameData.original,
        gameData.partner,
        gameData.partnerId,
      );

      // Track the selected pair for display purposes
      setSelectedPairForDisplay(selection.selectedPair ?? null);

      /**
       * Establish the baseline bottom pair for the entire match/series.
       *
       * - partnerPair mode: baseline is explicitly the selected pair
       * - fullMatch mode: baseline is whichever partner pair is currently on the bottom
       *   (respecting the user's current pre-match orientation)
       */
      const baseline: PairKey | null = (() => {
        if (selection.mode === "partnerPair" && selection.selectedPair) {
          // `selectedPair.usernames` is already normalized (lowercase + sorted) by `extractPartnerPairs`.
          return selection.selectedPair.usernames as PairKey;
        }

        const bottom = getBottomPairKeyForGame({
          gameData: { original: gameData.original, partner: gameData.partner },
          effectiveFlip: standaloneBoardsFlipped,
        });
        return bottom;
      })();
      setBaselineBottomPairKey(baseline);
      // Baseline is chosen to match the current bottom pair, so start with “no inversion”.
      setUserFlipPreference(false);

      // Set initial state
      setMatchGames([initialMatchGame]);
      setMatchCurrentIndex(0);
      setMatchDiscoveryStatus("discovering");
      setHasUserInitiatedMatchDiscovery(true);

      // Start discovery (searches both backward and forward)
      discoverMatchGames(
        {
          originalGame: gameData.original,
          partnerGame: gameData.partner,
          partnerId: gameData.partnerId,
          mode: selection.mode,
          selectedPair: selection.selectedPair,
        },
        {
          onGameFound: (newGame, direction) => {
            setMatchGames((prev) => {
              // Avoid duplicates
              if (prev.some((g) => g.gameId === newGame.gameId)) {
                return prev;
              }
              // Insert in chronological order
              const updated = [...prev, newGame];
              updated.sort((a, b) => a.endTime - b.endTime);
              return updated;
            });

            // When games are found before the initial game, the initial game's
            // index shifts up by one. Update currentIndex to stay on the initial game.
            if (direction === "before") {
              setMatchCurrentIndex((prev) => prev + 1);
            }
          },
          onComplete: (totalGames, initialGameIndex) => {
            setMatchDiscoveryStatus("complete");
            // Ensure currentIndex is set to the initial game's final position
            setMatchCurrentIndex(initialGameIndex);
            const seriesType =
              selection.mode === "partnerPair" ? "partner series" : "match";

            // Log analytics for match discovery completion
            logAnalyticsEvent(analytics, "match_discovery_complete", {
              mode: selection.mode,
              total_games: totalGames,
              found_additional: totalGames > 1 ? "true" : "false",
            });

            if (totalGames > 1) {
              toast.success(`Found ${totalGames} games in this ${seriesType}`);
            } else {
              toast.success(`No additional ${seriesType} games found`);
            }
          },
          onError: (error) => {
            setMatchDiscoveryStatus("error");

            // Log analytics for match discovery error
            logAnalyticsEvent(analytics, "match_discovery_error", {
              mode: selection.mode,
              error: error.message || "unknown",
            });

            toast.error(error.message || "Failed to find match games");
          },
          onProgress: (checked, found) => {
            // Could update a progress indicator here if needed
            console.debug(`Match discovery: checked ${checked}, found ${found}`);
          },
        },
        cancellation,
      );
    },
    [gameData, standaloneBoardsFlipped, analytics],
  );

  /**
   * Handles cancellation of the discovery mode modal.
   */
  const handleDiscoveryModalCancel = useCallback(() => {
    setIsDiscoveryModalOpen(false);
  }, []);

  /**
   * Navigates to the previous game in the match.
   */
  const handlePreviousGame = useCallback(() => {
    if (matchCurrentIndex <= 0 || matchGames.length === 0) return;

    const newIndex = matchCurrentIndex - 1;
    const targetGame = matchGames[newIndex];

    logAnalyticsEvent(analytics, "match_navigation", {
      direction: "previous",
      from_index: matchCurrentIndex,
      to_index: newIndex,
      total_games: matchGames.length,
    });

    setMatchCurrentIndex(newIndex);
    setGameData({
      original: targetGame.original,
      partner: targetGame.partner,
      partnerId: targetGame.partnerGameId,
    });
  }, [matchCurrentIndex, matchGames, analytics]);

  /**
   * Navigates to the next game in the match.
   */
  const handleNextGame = useCallback(() => {
    if (matchCurrentIndex >= matchGames.length - 1) return;

    const newIndex = matchCurrentIndex + 1;
    const targetGame = matchGames[newIndex];

    logAnalyticsEvent(analytics, "match_navigation", {
      direction: "next",
      from_index: matchCurrentIndex,
      to_index: newIndex,
      total_games: matchGames.length,
    });

    setMatchCurrentIndex(newIndex);
    setGameData({
      original: targetGame.original,
      partner: targetGame.partner,
      partnerId: targetGame.partnerGameId,
    });
  }, [matchCurrentIndex, matchGames, analytics]);

  /**
   * Navigates to a specific game in the match by index.
   */
  const handleSelectGame = useCallback((index: number) => {
    if (index < 0 || index >= matchGames.length) return;

    const targetGame = matchGames[index];

    logAnalyticsEvent(analytics, "match_navigation", {
      direction: "select",
      from_index: matchCurrentIndex,
      to_index: index,
      total_games: matchGames.length,
    });

    setMatchCurrentIndex(index);
    setGameData({
      original: targetGame.original,
      partner: targetGame.partner,
      partnerId: targetGame.partnerGameId,
    });
  }, [matchGames, analytics, matchCurrentIndex]);

  /**
   * Compute the board orientation for the currently displayed game.
   *
   * - When a match baseline is established: `effectiveFlip = baseFlip XOR userFlipPreference`
   * - Otherwise: use the standalone flip preference.
   */
  const effectiveBoardsFlipped = (() => {
    if (!gameData) return standaloneBoardsFlipped;
    if (!baselineBottomPairKey) return standaloneBoardsFlipped;

    const baseFlip = computeBaseFlip({
      baselineBottomPairKey,
      gameData: { original: gameData.original, partner: gameData.partner },
    });
    return computeEffectiveFlip({ baseFlip, userFlipPreference });
  })();

  const handleBoardsFlippedChange = useCallback(
    (nextEffectiveFlip: boolean) => {
      logAnalyticsEvent(analytics, "boards_flipped", {
        new_orientation: nextEffectiveFlip ? "flipped" : "normal",
        in_match: baselineBottomPairKey ? "true" : "false",
      });

      if (!gameData || !baselineBottomPairKey) {
        setStandaloneBoardsFlipped(nextEffectiveFlip);
        return;
      }

      const baseFlip = computeBaseFlip({
        baselineBottomPairKey,
        gameData: { original: gameData.original, partner: gameData.partner },
      });

      // effective = baseFlip XOR userFlipPreference  =>  userFlipPreference = baseFlip XOR effective
      setUserFlipPreference(baseFlip !== nextEffectiveFlip);
    },
    [baselineBottomPairKey, gameData, analytics],
  );

  // Cleanup discovery on unmount
  useEffect(() => {
    return () => {
      if (discoveryCancellationRef.current) {
        discoveryCancellationRef.current.cancel();
      }
    };
  }, []);

  /**
   * Determines the content type for sharing based on current state.
   * - If match discovery is complete and we have multiple games: "match" or "partnerGames"
   * - If a single game is loaded: "game"
   */
  const shareContentType: SharedContentType = (() => {
    if (matchDiscoveryStatus === "complete" && matchGames.length > 1) {
      return selectedPairForDisplay ? "partnerGames" : "match";
    }
    return "game";
  })();

  /**
   * Whether match discovery is currently in progress.
   */
  const isDiscovering = matchDiscoveryStatus === "discovering";

  /**
   * Determines whether sharing is allowed and why it might be blocked.
   */
  const shareEligibility = getShareEligibility({
    isFullyAuthenticated,
    loadedGameId: loadedGameId ?? null,
    isDiscovering,
    sharedId,
    matchDiscoveryStatus,
    matchGamesCount: matchGames.length,
    hasUserInitiatedMatchDiscovery,
    authMessage: getFullAuthRequirementMessage(fullAuthStatus),
  });

  /**
   * Whether the share button should be enabled.
   */
  const canShare = shareEligibility.canShare;

  /**
   * Message explaining why sharing is disabled.
   */
  const shareDisabledReason = shareEligibility.disabledReason;

  /**
   * Opens the share modal.
   */
  const handleShareClick = useCallback(() => {
    if (!canShare) return;
    logAnalyticsEvent(analytics, "share_button_clicked", {
      has_match: matchGames.length > 0 ? "true" : "false",
      match_game_count: matchGames.length > 0 ? matchGames.length : 0,
    });
    setIsShareModalOpen(true);
  }, [canShare, analytics, matchGames.length]);

  /**
   * Handles successful share.
   */
  const handleShareSuccess = useCallback((sharedId: string) => {
    console.debug("[GameViewerPage] Game shared successfully:", sharedId);
    // Modal will close itself
  }, []);

  const schedulePrefetchForRawInput = useCallback((rawInput: string) => {
      if (typeof window === "undefined") return;

      if (prefetchDebounceTimeoutRef.current !== null) {
        window.clearTimeout(prefetchDebounceTimeoutRef.current);
        prefetchDebounceTimeoutRef.current = null;
      }
      // Invalidate any in-flight prefetch.
      prefetchSeqRef.current += 1;

      const sanitizedId = sanitizeChessComGameIdInput(rawInput);
      if (!sanitizedId) {
        setPrefetched({ status: "idle" });
        return;
      }

      if (!isValidChessComGameId(sanitizedId)) {
        setPrefetched({
          status: "invalid",
          sanitizedId,
          message: "Invalid game ID. Chess.com game IDs must be 10, 11, or 12 digits.",
        });
        return;
      }

      // If we already have a result for this exact ID, keep it (avoid refetch loops).
      const existing = prefetchedRef.current;
      if (existing.status !== "idle" && "sanitizedId" in existing && existing.sanitizedId === sanitizedId) {
        return;
      }

      const seq = ++prefetchSeqRef.current;
      const debounceMs = 200;
      setPrefetched({ status: "loading", sanitizedId });

      prefetchDebounceTimeoutRef.current = window.setTimeout(() => {
        void (async () => {
          try {
            const originalGame = await fetchChessGame(sanitizedId);
            if (seq !== prefetchSeqRef.current) return;

            if (!originalGame) {
              setPrefetched({
                status: "error",
                sanitizedId,
                message: buildNoGameFoundMessage(sanitizedId),
              });
              return;
            }

            const nonBughouseError = getNonBughouseGameErrorMessage(originalGame);
            if (nonBughouseError) {
              setPrefetched({ status: "error", sanitizedId, message: nonBughouseError });
              return;
            }

            const partnerId = await findPartnerGameId(sanitizedId);
            if (seq !== prefetchSeqRef.current) return;

            const partnerGame = partnerId ? await fetchChessGame(partnerId) : null;
            if (seq !== prefetchSeqRef.current) return;

            setPrefetched({
              status: "ready",
              sanitizedId,
              data: { original: originalGame, partner: partnerGame, partnerId },
            });
          } catch (err: unknown) {
            if (seq !== prefetchSeqRef.current) return;
            setPrefetched({
              status: "error",
              sanitizedId,
              message: normalizeLoadGameErrorMessage({ err, sanitizedId }),
            });
          }
        })();
      }, debounceMs);
    }, []);

  useEffect(() => {
    // Bonus: also prefetch the seeded sample game ID on initial load.
    if (!shouldSeedWithSample) return;
    if (didPrefetchSeededSampleRef.current) return;
    if (!gameId) return;

    didPrefetchSeededSampleRef.current = true;
    const timeoutId = window.setTimeout(() => {
      schedulePrefetchForRawInput(gameId);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [gameId, schedulePrefetchForRawInput, shouldSeedWithSample]);

  useEffect(() => {
    prefetchedRef.current = prefetched;
  }, [prefetched]);

  useEffect(() => {
    // Cleanup any pending debounce timer on unmount.
    return () => {
      if (prefetchDebounceTimeoutRef.current !== null) {
        window.clearTimeout(prefetchDebounceTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!autoLoadGameId) {
      return;
    }

    if (lastAutoLoadedIdRef.current === autoLoadGameId) {
      return;
    }

    lastAutoLoadedIdRef.current = autoLoadGameId;
    const timeoutId = window.setTimeout(() => {
      void loadGame(autoLoadGameId, { skipConfirm: true, clearInput: true });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [autoLoadGameId, loadGame]);

  /**
   * Effect to load shared games from Firestore.
   * When a sharedId is present in the URL, we load the game data from our database
   * instead of fetching from Chess.com.
   */
  useEffect(() => {
    if (!sharedId) {
      return;
    }

    if (lastAutoLoadedSharedIdRef.current === sharedId) {
      return;
    }

    lastAutoLoadedSharedIdRef.current = sharedId;

    startTransition(() => {
      const loadSharedGamePromise = (async () => {
        const sharedGame = await getSharedGame(sharedId);
        if (!sharedGame) {
          throw new Error("Shared game not found");
        }

        return sharedGame;
      })();

      toast.promise(loadSharedGamePromise, {
        loading: "Loading shared game...",
        success: "Shared game loaded!",
        error: (err: unknown) => {
          const message = err instanceof Error ? err.message : "Failed to load shared game";
          return message;
        },
      });

      loadSharedGamePromise
        .then((sharedGame) => {
          const { gameData: storedData, type } = sharedGame;

          // Log analytics for shared game loaded
          logAnalyticsEvent(analytics, "shared_game_loaded", {
            shared_id: sharedId,
            content_type: storedData.type,
            game_count: storedData.type === "game" ? 1 : storedData.games.length,
          });

          let sharedBaselineBottomPairKey: PairKey | null = null;

          if (storedData.type === "game") {
            // Single game
            const { game } = storedData;
            setGameData({
              original: game.original,
              partner: game.partner,
              partnerId: game.partnerId,
            });
            setPristineGameData(game);
            setMatchGames([]);
            setMatchCurrentIndex(0);
            setMatchDiscoveryStatus("idle");
            setHasUserInitiatedMatchDiscovery(false);
          } else {
            // Match or partner games
            const matchGameData = fromMatchGameData(storedData.games);
            if (matchGameData.length === 0) {
              throw new Error("No games in shared match");
            }

            // Set the first game as the current game
            const firstGame = matchGameData[0]!;
            setGameData({
              original: firstGame.original,
              partner: firstGame.partner,
              partnerId: firstGame.partnerGameId,
            });
            setPristineGameData({
              original: firstGame.original,
              partner: firstGame.partner,
              partnerId: firstGame.partnerGameId,
            });

            // Set up match state
            setMatchGames(matchGameData);
            setMatchCurrentIndex(0);
            setMatchDiscoveryStatus("complete");
            setHasUserInitiatedMatchDiscovery(false);

            // For partner games, reconstruct the selected pair from metadata
            // The metadata.team1 contains the partner pair, and team2 is "Random Opponents"
            let selectedPair: PartnerPair | null = null;
            if (type === "partnerGames") {
              selectedPair = reconstructPartnerPairFromMetadata(sharedGame.metadata);

              // Fallback: try to extract from first game if metadata doesn't match expected format
              if (!selectedPair) {
                selectedPair = extractPartnerPairs(firstGame.original, firstGame.partner)?.[0] ?? null;
              }
            }

            setSelectedPairForDisplay(selectedPair);
            sharedBaselineBottomPairKey = getSharedMatchBaselineBottomPairKey({
              contentType: type,
              matchGames: matchGameData,
              selectedPair,
            });
          }

          // Reset other state
          setGameId("");
          setPrefetched({ status: "idle" });
          if (discoveryCancellationRef.current) {
            discoveryCancellationRef.current.cancel();
            discoveryCancellationRef.current = null;
          }
          setBaselineBottomPairKey(sharedBaselineBottomPairKey);
          setUserFlipPreference(false);
          setStandaloneBoardsFlipped(false);
        })
        .catch((err: unknown) => {
          console.error("[GameViewerPage] Failed to load shared game:", err);
          logAnalyticsEvent(analytics, "shared_game_load_error", {
            shared_id: sharedId ?? "unknown",
            error: err instanceof Error ? err.message : "unknown",
          });
        });
    });
  }, [sharedId, startTransition, analytics]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    // Log analytics event for Load Game button click
    // Firebase Analytics has built-in throttling to prevent excessive event logging
    logAnalyticsEvent(analytics, "load_game_button_click", {
      game_id_input: gameId.trim() || "empty",
    });

    await loadGame(gameId);
  };

  const handleGameIdInputChange = (nextValue: string) => {
    setGameId(nextValue);
    schedulePrefetchForRawInput(nextValue);
  };

  return (
    <div className="h-full bg-gray-900 flex flex-col overflow-y-hidden overflow-x-visible">
      {pendingLoadRequest ? (
        <ConfirmLoadNewGameModal
          open={true}
          existingLabel={pendingLoadRequest.existingLabel}
          newGameId={pendingLoadRequest.sanitizedId}
          onConfirm={handleConfirmLoadNewGame}
          onCancel={handleCancelLoadNewGame}
        />
      ) : null}
      <MatchDiscoveryModeModal
        open={isDiscoveryModalOpen}
        partnerPairs={
          gameData ? extractPartnerPairs(gameData.original, gameData.partner) : null
        }
        onSelect={handleDiscoveryModeSelect}
        onCancel={handleDiscoveryModalCancel}
      />
      {isDesktopLayout ? <GameLoadCounterFloating label={gamesLoadedLabel} /> : null}
      <header
        className={[
          // Fixed positioning ensures the header renders above the sidebar regardless of
          // stacking context issues in the flex layout. The header spans the full viewport width.
          "fixed top-0 left-0 right-0 z-50 bg-gray-800 border-b border-gray-700 shadow-md",
          isCompactLandscape ? "py-1" : "py-3",
        ].join(" ")}
      >
        <div
          className={[
            "mx-auto flex w-full max-w-[1600px] items-center px-4 sm:px-6 lg:px-8",
            isCompactLandscape ? "gap-3" : "gap-6",
          ].join(" ")}
        >
          <div className="flex items-center gap-2">
            <Link
              href="/"
              aria-label="Go to home page"
              onClick={(e) => {
                e.preventDefault();
                window.location.href = "/";
              }}
            >
              <Image
                src="/logo.png"
                alt="Bughouse Chess logo"
                width={40}
                height={40}
                priority
                className={[
                  "rounded object-contain",
                  isCompactLandscape ? "h-7 w-7" : "h-10 w-10",
                ].join(" ")}
              />
            </Link>
          </div>

          <form
            onSubmit={handleSubmit}
            className={[
              "flex-1 max-w-lg",
              // In compact landscape, prioritize keeping the right-side controls visible.
              isCompactLandscape ? "max-w-md" : "max-w-lg",
            ].join(" ")}
          >
            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={gameId}
                  onChange={(e) => handleGameIdInputChange(e.target.value)}
                  placeholder="Enter chess.com Game ID or URL"
                  className={[
                    "flex-1 rounded bg-gray-900 border border-gray-600 text-white placeholder-gray-400 outline-none transition-all",
                    "focus:border-mariner-400 focus:ring-1 focus:ring-mariner-500/50",
                    isCompactLandscape ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
                  ].join(" ")}
                  disabled={isPending}
                />
                <button
                  type="submit"
                  disabled={isPending || !gameId}
                  className={[
                    "bg-mariner-600 text-white rounded font-medium hover:bg-mariner-400 hover:border-mariner-300 cursor-pointer",
                    "disabled:bg-gray-700 disabled:text-gray-500 disabled:border-gray-700 disabled:cursor-not-allowed",
                    "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900",
                    isCompactLandscape ? "px-2.5 py-1 text-xs" : "px-4 py-1.5 text-sm",
                  ].join(" ")}
                >
                  {isPending ? "Loading..." : "Load Game"}
                </button>
              </div>

            </div>
          </form>

          {/* Match Navigation and Game ID section */}
          <div
            className={[
            "ml-auto inline-flex items-center",
              isCompactLandscape ? "gap-2" : "gap-3",
            ].join(" ")}
          >
            <MatchNavigation
              hasGameLoaded={!!loadedGameId}
              discoveryStatus={matchDiscoveryStatus}
              totalGames={matchGames.length}
              currentIndex={matchCurrentIndex}
              matchGames={matchGames}
              selectedPair={selectedPairForDisplay}
              onFindMatchGames={handleFindMatchGames}
              onPreviousGame={handlePreviousGame}
              onNextGame={handleNextGame}
              onSelectGame={handleSelectGame}
              isPending={isPending}
              density={isCompactLandscape ? "compact" : "default"}
            />

            {loadedGameId && (
              <>
                {/* Vertical separator */}
                <div className="h-6 w-px bg-gray-600" aria-hidden="true" />

                {/* Game ID button */}
                <button
                  type="button"
                  onClick={() => void handleCopyShareLink()}
                  aria-label={`Copy share link for game ${loadedGameId}`}
                  data-tooltip-id={APP_TOOLTIP_ID}
                  data-tooltip-content="Copy share link"
                  data-tooltip-place="bottom"
                  className={[
                    "inline-flex items-center rounded border border-gray-600 bg-gray-900/60 text-gray-100",
                    "hover:bg-gray-900/80 hover:border-gray-500 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900",
                    isCompactLandscape ? "gap-1 px-2 py-1 text-xs" : "gap-1.5 px-3 py-1.5 text-sm",
                  ].join(" ")}
                >
                  <span className="font-semibold">{loadedGameId}</span>
                  <Share className={isCompactLandscape ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main content region: keep the page itself non-scrolling by constraining overflow here.
          The move list(s) inside the analysis UI remain independently scrollable.
          pt-16/pt-12 accounts for the fixed header height (header py-3 + content ~40px = ~64px, or ~48px in compact). */}
      <main
        className={[
          "flex w-full flex-1 overflow-x-hidden",
          // In compact landscape, allow the user to scroll down to the move list.
          isCompactLandscape ? "overflow-y-auto pt-12" : "overflow-hidden pt-16",
        ].join(" ")}
      >
        <div
          className={[
            "mx-auto flex w-full max-w-[1600px] flex-1 min-h-0 flex-col justify-start min-[1400px]:justify-center px-4 sm:px-6 lg:px-8",
            isCompactLandscape ? "py-2" : "py-4",
          ].join(" ")}
        >
          {/*
            Use `key` to force remount when game changes (e.g., navigating between match games).
            This cleanly resets all internal state including live replay timers/RAF loops.
          */}
          <BughouseAnalysis
            key={loadedGameId ?? "no-game"}
            gameData={gameData}
            isLoading={isPending}
            boardsFlipped={effectiveBoardsFlipped}
            onBoardsFlippedChange={handleBoardsFlippedChange}
            onAnalysisDirtyChange={setAnalysisIsDirty}
            gamesLoadedLabel={gamesLoadedLabel}
            showGamesLoadedInline={!isDesktopLayout}
            onShareClick={handleShareClick}
            canShare={canShare}
            shareDisabledReason={shareDisabledReason}
          />
        </div>
      </main>

      {/* Share Game Modal */}
      {isFullyAuthenticated && user && username && (
        <ShareGameModal
          open={isShareModalOpen}
          userId={user.uid}
          username={username}
          singleGameData={shareContentType === "game" ? pristineGameData : null}
          matchGames={shareContentType !== "game" ? matchGames : undefined}
          contentType={shareContentType}
          selectedPair={shareContentType === "partnerGames" ? selectedPairForDisplay : null}
          onClose={() => setIsShareModalOpen(false)}
          onSuccess={handleShareSuccess}
        />
      )}
    </div>
  );
}
