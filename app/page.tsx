import { Suspense } from "react";
import GameViewerPage from "./components/GameViewerPage";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-gray-300" role="status" aria-live="polite">
          Loading viewer...
        </div>
      }
    >
      <GameViewerPage />
    </Suspense>
  );
}
