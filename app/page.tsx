"use client";

import { useState, useTransition } from "react";
import { ChessGame, fetchChessGame, findPartnerGameId } from "./actions";
import { parseChessComCompressedMovelist } from "./chesscom_movelist_parse";

interface GameCardProps {
  title: string;
  game: ChessGame | null;
}

function GameCard({ title, game }: GameCardProps) {
  if (!game) {
    return (
      <div className="p-6 bg-gray-800 rounded-xl shadow-sm border border-gray-700">
        <h2 className="font-serif text-xl font-semibold text-white mb-4">
          {title}
        </h2>
        <p className="text-gray-400 italic">No game data available</p>
      </div>
    );
  }

  const { game: gameInfo, players } = game;
  const whitePlayer = players.bottom.color === "white" ? players.bottom : players.top;
  const blackPlayer = players.bottom.color === "black" ? players.bottom : players.top;

  return (
    <div className="p-6 bg-gray-800 rounded-xl shadow-sm border border-gray-700">
      <h2 className="font-serif text-xl font-semibold text-white mb-4">
        {title}
      </h2>
      
      {/* Game Status */}
      <div className="mb-4 p-3 bg-gray-700 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-300">Status:</span>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            gameInfo.isFinished 
              ? "bg-green-900/50 text-green-300" 
              : "bg-yellow-900/50 text-yellow-300"
          }`}>
            {gameInfo.isFinished ? "Finished" : "In Progress"}
          </span>
        </div>
        {gameInfo.resultMessage && (
          <p className="text-sm text-gray-300">{gameInfo.resultMessage}</p>
        )}
      </div>

      {/* Players */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
          <div className="flex items-center space-x-3">
            {whitePlayer.avatarUrl && (
              <img 
                src={whitePlayer.avatarUrl} 
                alt={whitePlayer.username}
                className="w-8 h-8 rounded-full"
              />
            )}
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-medium text-white">{whitePlayer.username}</span>
                {whitePlayer.chessTitle && (
                  <span className="px-2 py-1 bg-yellow-600 text-yellow-100 text-xs rounded font-medium">
                    {whitePlayer.chessTitle}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-300">
                {whitePlayer.rating} • {whitePlayer.countryName}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="w-4 h-4 bg-white border border-gray-300 rounded-sm mb-1"></div>
            {gameInfo.ratingChangeWhite && (
              <span className={`text-xs ${
                gameInfo.ratingChangeWhite > 0 ? "text-green-400" : "text-red-400"
              }`}>
                {gameInfo.ratingChangeWhite > 0 ? "+" : ""}{gameInfo.ratingChangeWhite}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
          <div className="flex items-center space-x-3">
            {blackPlayer.avatarUrl && (
              <img 
                src={blackPlayer.avatarUrl} 
                alt={blackPlayer.username}
                className="w-8 h-8 rounded-full"
              />
            )}
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-medium text-white">{blackPlayer.username}</span>
                {blackPlayer.chessTitle && (
                  <span className="px-2 py-1 bg-yellow-600 text-yellow-100 text-xs rounded font-medium">
                    {blackPlayer.chessTitle}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-300">
                {blackPlayer.rating} • {blackPlayer.countryName}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="w-4 h-4 bg-gray-900 border border-gray-600 rounded-sm mb-1"></div>
            {gameInfo.ratingChangeBlack && (
              <span className={`text-xs ${
                gameInfo.ratingChangeBlack > 0 ? "text-green-400" : "text-red-400"
              }`}>
                {gameInfo.ratingChangeBlack > 0 ? "+" : ""}{gameInfo.ratingChangeBlack}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Game Details */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-400">Time Control:</span>
          <p className="font-medium text-white">{gameInfo.pgnHeaders.TimeControl}s</p>
        </div>
        <div>
          <span className="text-gray-400">Moves:</span>
          <p className="font-medium text-white">{Math.floor(gameInfo.plyCount / 2)}</p>
        </div>
        <div>
          <span className="text-gray-400">Rated:</span>
          <p className="font-medium text-white">{gameInfo.isRated ? "Yes" : "No"}</p>
        </div>
        <div>
          <span className="text-gray-400">Variant:</span>
          <p className="font-medium text-white">{gameInfo.typeName}</p>
        </div>
      </div>

      {/* Parsed Bughouse PGN Moves */}
      {gameInfo.moveList && (
        <div className="mt-4 p-3 bg-gray-700 rounded-lg">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Bughouse PGN Moves:</h3>
          <div className="font-mono text-xs text-white bg-gray-900 p-3 rounded overflow-auto max-h-40">
            {(() => {
              try {
                const parsedMoves = parseChessComCompressedMovelist(gameInfo.moveList);
                return parsedMoves.length > 0 
                  ? parsedMoves.join(' ') 
                  : 'No moves to display';
              } catch (error) {
                return `Error parsing moves: ${error instanceof Error ? error.message : 'Unknown error'}`;
              }
            })()}
          </div>
        </div>
      )}

      {/* Raw Data Toggle */}
      <details className="mt-4">
        <summary className="text-sm text-mariner-400 cursor-pointer hover:text-mariner-300">
          View Raw Data
        </summary>
        <pre className="mt-2 font-mono text-xs text-gray-300 bg-gray-900 p-4 rounded-lg overflow-auto max-h-64 border border-gray-700">
          {JSON.stringify(game, null, 2)}
        </pre>
      </details>
    </div>
  );
}

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GameCard 
            title={`Original Game (${gameId})`}
            game={gameData.original}
          />
          <GameCard 
            title={`Partner Game ${gameData.partnerId ? `(${gameData.partnerId})` : ""}`}
            game={gameData.partner}
          />
        </div>
      )}
      </div>
    </div>
  );
}
