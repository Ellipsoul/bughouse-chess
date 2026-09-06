import "server-only";
import { cacheLife } from "next/cache";
import type { ChessGame } from "@/app/actions";
import { getAdminFirestore } from "@/app/utils/platform/firebaseAdmin";
import type { SharedGameSubDocument } from "@/app/types/sharedGame";

/** Only fixed Chess.com endpoints are fetched; arbitrary remote URLs are never accepted. */
async function fetchBoard(id: string): Promise<ChessGame | null> {
  // Older Chess.com records identify the partner by UUID rather than numeric ID.
  if (!/^(?:\d{1,20}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(id)) return null;
  const response = await fetch(`https://www.chess.com/callback/live/game/${id}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) return null;
  const board = await response.json() as ChessGame;
  return board?.game?.type === "bughouse" ? board : null;
}

/** Read just the first stored game, never the entire shared match or user collection. */
export async function loadPreview(source: "sharedId" | "gameId", id: string) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  if (source === "sharedId") {
    const ref = getAdminFirestore().collection("sharedGames").doc(id);
    const parent = await ref.get();
    if (!parent.exists) return null;
    const games = await ref.collection("games").orderBy("index").limit(1).get();
    const first = games.docs[0]?.data() as SharedGameSubDocument | undefined;
    if (!first?.data.original || !first.data.partner) return null;
    return { original: first.data.original, partner: first.data.partner, match: parent.data()?.type !== "game" };
  }
  const original = await fetchBoard(id);
  if (!original?.game.partnerGameId) return null;
  const partner = await fetchBoard(String(original.game.partnerGameId));
  if (!partner) return null;
  return { original, partner, match: false };
}
