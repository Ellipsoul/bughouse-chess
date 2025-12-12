"use client";

import { useState, useTransition } from "react";
import { ChessGame, fetchChessGame, findPartnerGameId } from "./actions";
import BughouseReplay from "./components/BughouseReplay";

export default function Home() {
  const [gameId, setGameId] = useState("159878252255");
  const [gameData, setGameData] = useState<
    {
      original: ChessGame;
      partner: ChessGame | null;
      partnerId: string | null;
    } | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        // Fetch the original game
        const originalGame = await fetchChessGame(gameId);

        // Try to find the partner game
        const partnerId = await findPartnerGameId(gameId);
        const partnerGame = partnerId ? await fetchChessGame(partnerId) : null;

        setGameData({
          original: originalGame,
          partner: partnerGame,
          partnerId,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="w-full bg-gray-800 border-b border-gray-700 px-4 py-3 shadow-md">
        <div className="max-w-[1600px] mx-auto flex items-center gap-6">
          {/* Logo Placeholder */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-mariner-600 rounded flex items-center justify-center text-white font-bold text-xl">
              B
            </div>
          </div>

          {/* Search Input */}
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
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full flex">
        <div className="flex flex-col justify-center flex-1 max-w-[1600px] mx-auto p-4">
          {error && (
            <div className="w-full p-4 mb-6 text-red-300 bg-red-900/20 rounded-lg border border-red-800 text-center">
              {error}
            </div>
          )}

          {!gameData && !error && !isPending && (
            <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
              <p className="text-lg">Enter a game ID above to get started</p>
            </div>
          )}

          {gameData && (
            <BughouseReplay
              gameData={gameData}
            />
          )}
        </div>
      </main>
    </div>
  );
}
