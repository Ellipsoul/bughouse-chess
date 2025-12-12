import GameViewerPage from "../components/GameViewerPage";

interface GamePageProps {
  params: {
    gameId: string;
  };
}

export default function GamePage({ params }: GamePageProps) {
  return <GameViewerPage initialGameId={params.gameId} />;
}

