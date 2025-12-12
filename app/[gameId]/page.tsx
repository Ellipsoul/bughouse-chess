import { Suspense } from "react";
import GameViewerPage from "../components/GameViewerPage";

interface GamePageProps {
  params: Promise<{
    gameId: string;
  }>;
}

export default async function GamePage({ params }: GamePageProps) {
  const resolvedParams = await params;

  return (
    <Suspense
      fallback={
        <div className="p-4 text-gray-300" role="status" aria-live="polite">
          Loading game...
        </div>
      }
    >
      <GameViewerPage initialGameId={resolvedParams.gameId} />
    </Suspense>
  );
}
