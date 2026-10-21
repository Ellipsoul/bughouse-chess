import type { MatchGame } from "@/app/types/match";
import type { MatchStatistics } from "./matchStatistics";
import { computeGameMaterial } from "./matchMaterial";

export async function calculateMatchStatistics(games: MatchGame[], fingerprint: string): Promise<MatchStatistics> {
  const stats: MatchStatistics = { version: 3, fingerprint, gameCount: games.length,
    moves: { A: 0, B: 0 }, material: { bughouse: {}, standard: {} } };
  for (const game of games) {
    // Yield between games; closing a dropdown does not cancel shared work.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    for (const [board, source] of [["A", game.original], ["B", game.partner]] as const) {
      const count = source?.game.moveList.length / 2;
      if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid move data");
      stats.moves[board] += count;
    }
    for (const preset of ["bughouse", "standard"] as const) {
      const values = computeGameMaterial(game, preset);
      const totals = stats.material[preset];
      if (!values) stats.material[preset] = null;
      else if (totals) for (const [name, value] of Object.entries(values)) {
        Object.defineProperty(totals, name, { value: (Object.hasOwn(totals, name) ? totals[name] : 0) + value, enumerable: true, configurable: true });
      }
    }
  }
  return stats;
}
