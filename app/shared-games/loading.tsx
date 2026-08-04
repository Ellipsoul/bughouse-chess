/**
 * @module shared-games/loading
 *
 * Next.js streaming fallback while the shared-games RSC payload resolves.
 */
import CenteredLoadingSpinner from "../components/ui/CenteredLoadingSpinner";

/**
 * Loading UI for the shared games route.
 */
export default function SharedGamesLoading() {
  return <CenteredLoadingSpinner label="Loading shared games..." />;
}
