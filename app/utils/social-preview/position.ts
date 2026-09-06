import type { ChessGame } from "@/app/actions";
import { processGameData } from "@/app/utils/board/moveOrdering";
import { BughouseReplayController } from "@/app/utils/replay/replayController";
import { parsePlyFromSearchParams, clampPlyToMainlineBounds } from "@/app/utils/discovery/gameViewerUrlState";

/** Keep preview URLs bounded and use the same source precedence as the viewer. */
export function previewParams(input: URLSearchParams): URLSearchParams | null {
  const result = new URLSearchParams();
  const sharedId = input.get("sharedId");
  const gameId = input.get("gameid") ?? input.get("gameId");
  if (sharedId) {
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(sharedId)) return null;
    result.set("sharedId", sharedId);
  } else if (gameId && /^\d{1,20}$/.test(gameId)) {
    result.set("gameId", gameId);
  } else return null;
  const ply = parsePlyFromSearchParams(input);
  if (ply !== null) result.set("ply", String(ply));
  return result;
}

/** URL ply is the number of applied global moves; zero is the starting position. */
export function previewPosition(original: ChessGame, partner: ChessGame, ply: number | null) {
  const processed = processGameData(original, partner);
  if (processed.combinedMoves.length > 10000) throw new Error("Preview game is too large");
  const replay = new BughouseReplayController(processed);
  const appliedPly = ply === null ? replay.getTotalMoves() : clampPlyToMainlineBounds(ply, replay.getTotalMoves());
  if (!replay.jumpToMove(appliedPly - 1)) throw new Error("Unable to replay preview position");
  return { state: replay.getCurrentGameState(), appliedPly };
}
