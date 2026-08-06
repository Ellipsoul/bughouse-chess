import { sanitizeChessComGameIdInput } from "./chessComGameIdInput";

const BUGHOUSE_ANALYSIS_URL = "https://bughouse.aronteh.com/";

/** Builds the public Relay analysis URL for a stored source-game URL or id. */
export function buildBughouseAnalysisUrl(sourceGame: string): string {
  const gameId = sanitizeChessComGameIdInput(sourceGame);
  const url = new URL(BUGHOUSE_ANALYSIS_URL);
  url.searchParams.set("gameId", gameId);
  return url.toString();
}
