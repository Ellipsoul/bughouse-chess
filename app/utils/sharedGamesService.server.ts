import "server-only";

import { cacheLife } from "next/cache";
import { getAdminFirestore } from "./firebaseAdmin";
import type { SharedGameSummary, SharedGameDocument } from "../types/sharedGame";
import { toSharedGameSummary } from "../types/sharedGame";

const SHARED_GAMES_COLLECTION = "sharedGames";

/**
 * Fetches all shared games (summaries only) from Firestore.
 * Uses Firebase Admin SDK for server-side access.
 * Results are cached for 1 minute to reduce database load.
 *
 * @returns Array of all shared game summaries, sorted by sharedAt (newest first)
 */
export async function getAllSharedGames(): Promise<SharedGameSummary[]> {
  "use cache";
  cacheLife({ revalidate: 60 }); // 1 minute revalidation

  try {
    const db = getAdminFirestore();
    const sharedGamesRef = db.collection(SHARED_GAMES_COLLECTION);

    // Fetch all games, ordered by sharedAt descending (newest first)
    const snapshot = await sharedGamesRef
      .orderBy("sharedAt", "desc")
      .get();

    if (snapshot.empty) {
      return [];
    }

    const games: SharedGameSummary[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as SharedGameDocument;
      return toSharedGameSummary(data);
    });

    return games;
  } catch (err) {
    console.error("[sharedGamesService.server] getAllSharedGames failed:", err);
    throw new Error("Failed to fetch shared games");
  }
}
