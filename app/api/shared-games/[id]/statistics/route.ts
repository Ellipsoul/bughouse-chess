import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/utils/platform/firebaseAdmin";
import { fromMatchGameData, type SharedGameDocument, type SharedGameSubDocument } from "@/app/types/sharedGame";
import { getMatchStatistics, isMatchStatistics, matchStatisticsKey } from "@/app/utils/match/matchStatistics";

export const runtime = "nodejs";

/** Public repair of derived data only. Never accept client-provided statistics or game payloads. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-zA-Z0-9-]{1,128}$/.test(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  try {
    const db = getAdminFirestore();
    const ref = db.collection("sharedGames").doc(id);
    const stats = await db.runTransaction(async tx => {
      const parent = await tx.get(ref);
      if (!parent.exists) throw new Error("NOT_FOUND");
      const data = parent.data() as SharedGameDocument;
      if (data.type === "game") throw new Error("NOT_MATCH");
      const snapshot = await tx.get(ref.collection("games").orderBy("index"));
      const rows = snapshot.docs.map(doc => doc.data() as SharedGameSubDocument);
      if (!rows.length || rows.length !== data.metadata.gameCount || rows.some((row, i) => row.type !== "match" || row.index !== i)) {
        throw new Error("INCOMPLETE");
      }
      const games = fromMatchGameData(rows.flatMap(row => row.type === "match" ? [row.data] : []));
      if (isMatchStatistics(data.matchStatistics, matchStatisticsKey(games), games.length)) return data.matchStatistics;
      const computed = await getMatchStatistics(games);
      tx.update(ref, { matchStatistics: computed });
      return computed;
    });
    return NextResponse.json(stats);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code === "NOT_FOUND" ? 404 : code === "NOT_MATCH" ? 400 : code === "INCOMPLETE" ? 409 : 503;
    return NextResponse.json({ error: "Match statistics unavailable" }, { status });
  }
}
