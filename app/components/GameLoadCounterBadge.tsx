"use client";

import { useEffect, useMemo, useState } from "react";
import {
  hasRecordedGameLoadThisSession,
  markRecordedGameLoadThisSession,
} from "../utils/metrics/gameLoadSession";

type MetricsResponse = {
  gamesLoaded: number;
};

/**
 * Bottom-right UI badge showing the global number of loaded games.
 *
 * Behavior:
 * - When `loadedGameId` changes, we either increment the global counter (once per
 *   session per game id) or just fetch the latest value.
 * - This component intentionally does *not* talk to Firestore directly; it only
 *   uses our server route (`/api/metrics/game-load`).
 */
export function useGameLoadCounterLabel(loadedGameId?: string | null): {
  gamesLoaded: number | null;
  isLoading: boolean;
  hasError: boolean;
  label: string;
} {
  const [gamesLoaded, setGamesLoaded] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const GAMES_LOADED_PREFIX: string = "Games Analysed: ";
  const label = useMemo(() => {
    if (isLoading) return `${GAMES_LOADED_PREFIX}…`;
    if (hasError) return `${GAMES_LOADED_PREFIX}—`;
    if (gamesLoaded == null) return `${GAMES_LOADED_PREFIX}—`;
    return `${GAMES_LOADED_PREFIX}${gamesLoaded.toLocaleString()}`;
  }, [gamesLoaded, hasError, isLoading]);

  useEffect(() => {
    const gameId = loadedGameId?.trim();
    if (!gameId) {
      // Still fetch the current value, so the badge isn't empty on first paint.
      // This is also useful if the page loads without a game and the user is
      // about to type one in.
      void (async () => {
        setIsLoading(true);
        setHasError(false);
        try {
          const res = await fetch("/api/metrics/game-load", {
            method: "GET",
            cache: "no-store",
          });
          const json = (await res.json()) as MetricsResponse;
          if (typeof json.gamesLoaded === "number") setGamesLoaded(json.gamesLoaded);
        } catch {
          setHasError(true);
        } finally {
          setIsLoading(false);
        }
      })();
      return;
    }

    if (typeof window === "undefined") return;

    const alreadyRecorded = hasRecordedGameLoadThisSession(
      window.sessionStorage,
      gameId,
    );

    void (async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        const res = await fetch("/api/metrics/game-load", {
          method: alreadyRecorded ? "GET" : "POST",
          headers: alreadyRecorded ? undefined : { "content-type": "application/json" },
          body: alreadyRecorded ? undefined : JSON.stringify({ gameId }),
          cache: "no-store",
        });

        const json = (await res.json()) as MetricsResponse;
        if (typeof json.gamesLoaded === "number") {
          setGamesLoaded(json.gamesLoaded);
        }

        if (!alreadyRecorded) {
          markRecordedGameLoadThisSession(window.sessionStorage, gameId);
        }
      } catch {
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadedGameId]);

  return { gamesLoaded, isLoading, hasError, label };
}

export function GameLoadCounterFloating({ label }: { label: string }) {
  return (
    <div className="fixed bottom-3 right-3 z-50 select-none">
      <div className="rounded-md bg-gray-900/85 px-3 py-2 text-xs text-gray-200 shadow-lg backdrop-blur">
        <span className="font-mono tabular-nums">{label}</span>
      </div>
    </div>
  );
}

export function GameLoadCounterInline({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span className={["font-mono tabular-nums", className ?? ""].join(" ").trim()}>
      {label}
    </span>
  );
}

export function GameLoadCounterBadge({
  loadedGameId,
}: {
  loadedGameId?: string | null;
}) {
  const { label } = useGameLoadCounterLabel(loadedGameId);

  return <GameLoadCounterFloating label={label} />;
}


