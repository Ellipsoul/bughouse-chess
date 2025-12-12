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
import BughouseReplay from "./BughouseReplay";

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
  const normalizedInitialGameId =
    pathGameId ?? queryGameId?.trim() ?? "159878252255";

  const [gameId, setGameId] = useState(normalizedInitialGameId);
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

      if (!skipConfirm && loadedGameId && loadedGameId !== trimmedId) {
        const shouldLoadNewGame = window.confirm(
          `Game ${loadedGameId} is already loaded. Do you want to load ${trimmedId}?`,
        );

        if (!shouldLoadNewGame) {
          return;
        }
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
    [loadedGameId, startTransition],
  );

  useEffect(() => {
    const autoLoadId = pathGameId ?? queryGameId?.trim();
    if (!autoLoadId) {
      return;
    }

    if (lastAutoLoadedIdRef.current === autoLoadId) {
      return;
    }

    lastAutoLoadedIdRef.current = autoLoadId;
    const timeoutId = window.setTimeout(() => {
      void loadGame(autoLoadId, { skipConfirm: true, clearInput: false });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pathGameId, queryGameId, loadGame]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await loadGame(gameId);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <header className="w-full bg-gray-800 border-b border-gray-700 px-4 py-3 shadow-md">
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
                className="px-4 py-1.5 text-sm bg-mariner-600 text-white rounded font-medium border border-mariner-400 hover:bg-mariner-400 hover:border-mariner-300 cursor-pointer disabled:bg-gray-700 disabled:text-gray-500 disabled:border-gray-700 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900"
              >
                {isPending ? "Loading..." : "Load Game"}
              </button>
            </div>
          </form>

          {loadedGameId && (
            <div className="ml-auto text-base text-gray-300">
              <span className="font-medium text-gray-100">Game ID:</span>{" "}
              <span className="text-gray-100 font-bold">{loadedGameId}</span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 w-full flex">
        <div className="flex flex-col justify-center flex-1 max-w-[1600px] mx-auto p-4">
          {error && (
            <div className="w-full p-4 mb-6 text-red-300 bg-red-900/20 rounded-lg border border-red-800 text-center">
              {error}
            </div>
          )}

          {isPending ? (
            <div
              className="flex flex-col items-center justify-center h-[60vh] text-gray-200"
              role="status"
              aria-live="polite"
            >
              <div className="h-12 w-12 rounded-full border-4 border-mariner-500/40 border-t-mariner-200 animate-spin mb-4" />
              <p className="text-sm text-gray-300">Loading game data...</p>
            </div>
          ) : gameData ? (
            <BughouseReplay gameData={gameData} />
          ) : (
            !error && (
              <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
                <p className="text-lg">Enter a game ID above to get started</p>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}


