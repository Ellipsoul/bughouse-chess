import SharedGamesPageClient from "./SharedGamesPageClient";
import { getAllSharedGames } from "../utils/sharedGamesService.server";

/**
 * Shared games browsing page.
 * Fetches all shared games on the server with caching and passes them to the client component.
 */
export default async function SharedGamesPage() {
  const games = await getAllSharedGames();

  return <SharedGamesPageClient games={games} />;
}
