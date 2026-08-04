/**
 * @module shared-games/page
 *
 * Server entry for `/shared-games`; prefetches summaries and hydrates the client grid.
 */
import SharedGamesPageClient from "./SharedGamesPageClient";
import { getAllSharedGames } from "../utils/shared-games/sharedGamesService.server";

/**
 * Shared games browsing page.
 * Fetches all shared games on the server with caching and passes them to the client component.
 */
export default async function SharedGamesPage() {
  const games = await getAllSharedGames();

  return <SharedGamesPageClient games={games} />;
}
