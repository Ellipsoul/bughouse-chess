/**
 * @module app/page
 *
 * Application entry route (`/`). The home page is intentionally thin: it wraps
 * {@link GameViewerPage} in React Suspense so URL-driven game loading can suspend
 * without blocking the root layout shell.
 */
import { Suspense } from "react";
import CenteredLoadingSpinner from "./components/ui/CenteredLoadingSpinner";
import GameViewerPage from "./components/viewer/GameViewerPage";

/**
 * Landing page that hosts the bughouse game viewer with a suspense fallback.
 */
export default function Home() {
  return (
    <Suspense
      fallback={
        <CenteredLoadingSpinner label="Loading viewer..." />
      }
    >
      <GameViewerPage />
    </Suspense>
  );
}
