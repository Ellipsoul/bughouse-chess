import { Suspense } from "react";
import SharedGamesPageClient from "./SharedGamesPageClient";

/**
 * Shared games browsing page.
 * Displays all shared games from users across the platform.
 */
export default function SharedGamesPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full w-full bg-gray-900 flex items-center justify-center">
          <div className="text-gray-300" role="status" aria-live="polite">
            Loading shared games...
          </div>
        </div>
      }
    >
      <SharedGamesPageClient />
    </Suspense>
  );
}
