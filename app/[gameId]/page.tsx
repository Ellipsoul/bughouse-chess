import { Suspense } from "react";
import GameViewerPage from "../components/GameViewerPage";

interface GamePageProps {
  params: {
    gameId: string;
  };
}

/**
 * Dynamic route that preloads the viewer with the game ID from the URL.
 */
export default function GamePage({ params }: GamePageProps) {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-gray-300" role="status" aria-live="polite">
          Loading game...
        </div>
      }
    >
      <GameViewerPage initialGameId={params.gameId} />
    </Suspense>
  );
}
