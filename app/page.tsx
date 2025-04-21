"use client";

import { useState, useTransition } from "react";
import { ChessGame, fetchChessGame, findPartnerGameId } from "./actions";

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
    <main className="min-h-screen p-8 bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Bughouse Chess Viewer</h1>

        <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
          <input
            type="text"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            placeholder="Enter Chess.com game ID"
            className="flex-1 p-2 border rounded bg-gray-800 text-white"
            disabled={isPending}
          />
          <button
            type="submit"
            disabled={isPending || !gameId}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
          >
            {isPending ? "Loading..." : "Fetch Game"}
          </button>
        </form>

        {error && (
          <div className="p-4 mb-4 text-red-300 bg-red-900 rounded">
            {error}
          </div>
        )}

        {gameData && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-800 rounded overflow-auto">
              <h2 className="text-lg font-semibold mb-2">
                Original Game ({gameId})
              </h2>
              <pre className="text-gray-300">
                {JSON.stringify(gameData.original, null, 2)}
              </pre>
            </div>
            <div className="p-4 bg-gray-800 rounded overflow-auto">
              <h2 className="text-lg font-semibold mb-2">
                Partner Game{" "}
                {gameData.partnerId ? `(${gameData.partnerId})` : ""}
              </h2>
              {gameData.partner
                ? (
                  <pre className="text-gray-300">
                  {JSON.stringify(gameData.partner, null, 2)}
                  </pre>
                )
                : <p className="text-gray-400">No partner game found</p>}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
