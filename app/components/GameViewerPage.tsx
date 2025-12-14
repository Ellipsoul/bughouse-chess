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
import { ChessGame, fetchChessGame, findPartnerGameId } from "../actions";
import BughouseAnalysis from "./BughouseAnalysis";

interface GameViewerPageProps {
  /**
   * Optional game ID derived from the URL path. When provided, the viewer will
   * auto-load the game on first render without requiring manual input.
   */
  initialGameId?: string;
}

/**
 * Top-level viewer page: loads bughouse games from chess.com and renders the replay UI.
 */
export default function GameViewerPage({ initialGameId }: GameViewerPageProps) {
  const searchParams = useSearchParams();
  const pathGameId = initialGameId?.trim();
  const queryGameId = searchParams.get("gameid") ?? searchParams.get("gameId");
  const autoLoadGameId = pathGameId ?? queryGameId?.trim();
  const defaultSampleGameId = "159878252255";
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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const loadedGameId = gameData?.original?.game?.id?.toString();
  const lastAutoLoadedIdRef = useRef<string | null>(null);
  const [analysisIsDirty, setAnalysisIsDirty] = useState(false);

  /**
   * Fetches the primary game (and partner game when available) then updates UI state.
   */
  const loadGame = useCallback(
    async (
      requestedGameId: string,
      options: { skipConfirm?: boolean; clearInput?: boolean } = {},
    ) => {
      const { skipConfirm = false, clearInput = true } = options;
      const trimmedId = requestedGameId.trim();

      if (!trimmedId) {
        setError("Game ID is required");
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
        setError(null);

        const loadPromise = (async () => {
          const originalGame = await fetchChessGame(trimmedId);
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
          error: (err: unknown) =>
            err instanceof Error ? err.message : "Failed to load game",
        });

        loadPromise
          .then((data) => {
            setGameData(data);
            setGameId(clearInput ? "" : trimmedId);
          })
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "An error occurred");
          });
      });
    },
    [analysisIsDirty, loadedGameId, startTransition],
  );

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
    await loadGame(gameId);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <header className="relative w-full bg-gray-800 border-b border-gray-700 px-4 py-3 shadow-md">
        <div className="max-w-[1600px] mx-auto flex items-center gap-6 w-full">
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
            <div className="flex gap-2">
              <input
                type="text"
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                placeholder="Enter chess.com Game ID"
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
          </form>

          {loadedGameId && (
            <div className="ml-auto mr-12 sm:mr-14 text-base text-gray-300">
              <span className="font-medium text-gray-100">Game ID:</span>{" "}
              <span className="text-gray-100 font-bold">{loadedGameId}</span>
            </div>
          )}
        </div>

        {/* Keep the GitHub link out of the way: pinned to the far right edge. */}
        <a
          href="https://github.com/Ellipsoul/bughouse-chess"
          target="_blank"
          rel="noreferrer noopener"
          aria-label="View source code on GitHub"
          title="View source code on GitHub"
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
        </a>
      </header>

      <main className="flex-1 w-full flex">
        <div className="flex flex-col justify-center flex-1 max-w-[1600px] mx-auto p-4">
          {error && (
            <div className="w-full p-4 mb-6 text-red-300 bg-red-900/20 rounded-lg border border-red-800 text-center">
              {error}
            </div>
          )}

          <BughouseAnalysis
            gameData={gameData}
            isLoading={isPending}
            onAnalysisDirtyChange={setAnalysisIsDirty}
          />
        </div>
      </main>
    </div>
  );
}


