"use client";

import { useState, useTransition } from "react";
import { ChessGame, fetchChessGame, findPartnerGameId } from "./actions";
import BughouseReplay from "./components/BughouseReplay";

export default function Home() {
  const [gameId, setGameId] = useState("");
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
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="font-serif text-4xl font-bold text-white mb-4">
            Bughouse Chess Viewer
          </h1>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Enter a Chess.com game ID to view both the original game and its
            partner game in the bughouse format.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto mb-8">
          <div className="flex gap-3">
            <input
              type="text"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              placeholder="Enter Chess.com game ID"
              className="flex-1 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:border-mariner-400 focus:ring-2 focus:ring-mariner-500/20 outline-none transition-all"
              disabled={isPending}
            />
            <button
              type="submit"
              disabled={isPending || !gameId}
              className="px-6 py-3 bg-mariner-600 text-white rounded-lg font-medium hover:bg-mariner-700 focus:ring-2 focus:ring-mariner-500/20 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? "Loading..." : "Fetch Game"}
            </button>
          </div>
        </form>

        {error && (
          <div className="max-w-2xl mx-auto p-4 mb-8 text-red-300 bg-red-900/20 rounded-lg border border-red-800">
            {error}
          </div>
        )}

        {gameData && (
          <div className="space-y-6">
            <BughouseReplay
              gameData={gameData}
            />
          </div>
        )}
      </div>
    </div>
  );
}
