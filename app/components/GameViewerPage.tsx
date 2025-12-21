"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
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
 * All Chess.com game IDs are exactly 12-digit numeric values.
 *
 * @param gameId - The game ID string to validate
 * @returns `true` if the game ID is valid, `false` otherwise
 */
function isValidChessComGameId(gameId: string): boolean {
  // Chess.com game IDs must be exactly 12 digits
  return /^\d{12}$/.test(gameId);
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
  const searchParams = useSearchParams();
  const queryGameId = searchParams.get("gameid") ?? searchParams.get("gameId");
  const autoLoadGameId = queryGameId?.trim();
  /**
   * Randomly select a sample game ID from available fixtures to provide variety
   * for users visiting without a specific game ID.
   */
  const defaultSampleGameId = getRandomSampleGameId();
  const shouldSeedWithSample = !autoLoadGameId;

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
  const [analysisIsDirty, setAnalysisIsDirty] = useState(false);
  const isDesktopLayout = useMediaQuery("(min-width: 1400px)");
  const { label: gamesLoadedLabel } = useGameLoadCounterLabel(loadedGameId);
  const analytics = useFirebaseAnalytics();
  const [prefetched, setPrefetched] = useState<PrefetchedGameLoad>({ status: "idle" });
  const prefetchSeqRef = useRef(0);
  const prefetchDebounceTimeoutRef = useRef<number | null>(null);

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
        toast.error("Invalid game ID. Chess.com game IDs must be exactly 12 digits.");
        return;
      }

      if (!skipConfirm && (analysisIsDirty || loadedGameId)) {
        const existingLabel = loadedGameId ? `Game ${loadedGameId}` : "Your current analysis";
        const shouldLoadNewGame = window.confirm(
          `${existingLabel} is already loaded/modified.\n\nLoading game ${trimmedId} will replace all existing moves, variations, and position state.\n\nDo you want to continue?`,
        );
        if (!shouldLoadNewGame) return;
      }

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
            setGameData(data);
            setGameId(clearInput ? "" : trimmedId);
            if (clearInput) {
              setPrefetched({ status: "idle" });
            }
          })
          .catch((err: unknown) => {
            // `toast.promise` already displays the error; avoid rendering an inline banner
            // that would shift the board layout.
            toast.error(normalizeLoadGameErrorMessage({ err, sanitizedId: trimmedId }));
          });
      });
    },
    [analysisIsDirty, loadedGameId, prefetched, startTransition],
  );

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

    if (prefetchDebounceTimeoutRef.current !== null) {
      window.clearTimeout(prefetchDebounceTimeoutRef.current);
      prefetchDebounceTimeoutRef.current = null;
    }
    // Invalidate any in-flight prefetch.
    prefetchSeqRef.current += 1;

    const sanitizedId = sanitizeChessComGameIdInput(nextValue);
    if (!sanitizedId) {
      setPrefetched({ status: "idle" });
      return;
    }

    if (!isValidChessComGameId(sanitizedId)) {
      setPrefetched({
        status: "invalid",
        sanitizedId,
        message: "Invalid game ID. Chess.com game IDs must be exactly 12 digits.",
      });
      return;
    }

    // If we already have a result for this exact ID, keep it (avoid refetch loops).
    if (
      prefetched.status !== "idle" &&
      "sanitizedId" in prefetched &&
      prefetched.sanitizedId === sanitizedId
    ) {
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
  };

  return (
    <div className="h-full bg-gray-900 flex flex-col overflow-hidden">
      {isDesktopLayout ? <GameLoadCounterFloating label={gamesLoadedLabel} /> : null}
      <header className="relative w-full bg-gray-800 border-b border-gray-700 py-3 shadow-md">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Bughouse Chess logo"
              width={40}
              height={40}
              priority
              className="h-10 w-10 rounded"
            />
          </div>

          <form onSubmit={handleSubmit} className="flex-1 max-w-lg">
            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={gameId}
                  onChange={(e) => handleGameIdInputChange(e.target.value)}
                  placeholder="Enter chess.com Game ID or URL"
                  className="flex-1 px-3 py-1.5 text-sm rounded bg-gray-900 border border-gray-600 text-white placeholder-gray-400 focus:border-mariner-400 focus:ring-1 focus:ring-mariner-500/50 outline-none transition-all"
                  disabled={isPending}
                />
                <button
                  type="submit"
                  disabled={isPending || !gameId}
                  className="px-4 py-1.5 text-sm bg-mariner-600 text-white rounded font-medium hover:bg-mariner-400 hover:border-mariner-300 cursor-pointer disabled:bg-gray-700 disabled:text-gray-500 disabled:border-gray-700 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900"
                >
                  {isPending ? "Loading..." : "Load Game"}
                </button>
              </div>

            </div>
          </form>

          {loadedGameId && (
            <div className="ml-auto mr-12 sm:mr-14 inline-flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-200">Game ID:</span>
              <button
                type="button"
                onClick={() => void handleCopyShareLink()}
                aria-label={`Copy share link for game ${loadedGameId}`}
                data-tooltip-id={APP_TOOLTIP_ID}
                data-tooltip-content="Copy share link"
                data-tooltip-place="bottom"
                className="inline-flex items-center gap-2 rounded-md border border-gray-600 bg-gray-900/60 px-3 py-1.5 text-gray-100 hover:bg-gray-900/80 hover:border-gray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900"
              >
                <span className="font-bold text-gray-50">{loadedGameId}</span>
                <Share className="h-4 w-4 text-gray-200" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {/* Keep the GitHub link out of the way: pinned to the far right edge. */}
        <Link
          href="https://github.com/Ellipsoul/bughouse-chess"
          target="_blank"
          rel="noreferrer noopener"
          aria-label="View source code on GitHub"
          data-tooltip-id={APP_TOOLTIP_ID}
          data-tooltip-content="View source code on GitHub"
          data-tooltip-place="bottom-end"
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 inline-flex items-center justify-center rounded p-2 text-gray-300 hover:text-white hover:bg-gray-700/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-github-icon lucide-github"
          >
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
            <path d="M9 18c-4.51 2-5-2-7-2" />
          </svg>
        </Link>
      </header>

      {/* Main content region: keep the page itself non-scrolling by constraining overflow here.
          The move list(s) inside the analysis UI remain independently scrollable. */}
      <main className="flex w-full flex-1 overflow-hidden">
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 min-h-0 flex-col justify-start min-[1400px]:justify-center px-4 py-4 sm:px-6 lg:px-8">
          <BughouseAnalysis
            gameData={gameData}
            isLoading={isPending}
            onAnalysisDirtyChange={setAnalysisIsDirty}
            gamesLoadedLabel={gamesLoadedLabel}
            showGamesLoadedInline={!isDesktopLayout}
          />
        </div>
      </main>
    </div>
  );
}


