import type { ChessGame } from "../actions";

export type GameConclusionSummary = {
  /**
   * Primary result string, typically PGN `Result` (e.g. `1-0`, `0-1`, `1/2-1/2`).
   * Falls back to chess.com `resultMessage` if needed.
   */
  result: string;
  /**
   * Human-friendly reason the game concluded (e.g. "Checkmate", "Threefold repetition", "Time forfeit").
   */
  reason: string;
  /**
   * Which board payload we sourced the conclusion from.
   * This is informational (useful when only one of the two chess.com boards contains the decisive termination).
   */
  sourceBoard: "A" | "B";
};

function humanizeReason(raw: string): string {
  const normalized = raw.trim();
  if (!normalized) return "";

  const lower = normalized.toLowerCase();
  const mapped: Record<string, string> = {
    checkmate: "Checkmate",
    checkmated: "Checkmate",
    mate: "Checkmate",
    resignation: "Resignation",
    resigned: "Resignation",
    timeout: "Time forfeit",
    time: "Time forfeit",
    "time forfeit": "Time forfeit",
    flag: "Time forfeit",
    stalemate: "Stalemate",
    repetition: "Threefold repetition",
    "threefold repetition": "Threefold repetition",
    insufficient: "Insufficient material",
    "insufficient material": "Insufficient material",
    abandoned: "Abandoned",
    disconnect: "Disconnected",
    disconnected: "Disconnected",
    agreement: "Draw by agreement",
    "draw by agreement": "Draw by agreement",
  };

  if (lower in mapped) return mapped[lower]!;

  // Generic fallback: turn `time_forfeit` / `time-forfeit` into `Time forfeit`.
  const spaced = normalized.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function deriveSummaryFromSingleGame(game: ChessGame, sourceBoard: "A" | "B"): GameConclusionSummary | null {
  const result =
    game.game.pgnHeaders?.Result?.trim() ||
    game.game.resultMessage?.trim() ||
    "";

  const reasonRaw =
    game.game.pgnHeaders?.Termination?.trim() ||
    game.game.gameEndReason?.trim() ||
    "";

  const reason = humanizeReason(reasonRaw) || (game.game.resultMessage?.trim() ?? "");
  if (!result || !reason) return null;

  return { result, reason, sourceBoard };
}

/**
 * Attempt to extract the match conclusion ("Result" + termination reason) from the chess.com
 * live-game payloads. Bughouse matches have two linked games; in practice, the decisive
 * termination data is often present on *one* of the two boards.
 */
export function deriveBughouseConclusionSummary(
  original: ChessGame,
  partner: ChessGame | null,
): GameConclusionSummary | null {
  const candidates: Array<{ game: ChessGame; board: "A" | "B" }> = [
    { game: original, board: "A" },
    ...(partner ? [{ game: partner, board: "B" } as const] : []),
  ];

  // Prefer a finished game that has explicit termination metadata.
  const finished = candidates.filter((c) => Boolean(c.game.game.isFinished));
  const ordered = finished.length > 0 ? finished : candidates;

  for (const c of ordered) {
    const summary = deriveSummaryFromSingleGame(c.game, c.board);
    if (summary) return summary;
  }

  return null;
}


