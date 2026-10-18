import type { MatchGame } from "@/app/types/match";
import { processGameData } from "@/app/utils/board/moveOrdering";
import { createInitialPositionSnapshot, validateAndApplyMoveFromNotation } from "@/app/utils/analysis/applyMove";
import { reorderSimultaneousCheckmateMove } from "@/app/utils/analysis/reorderRecordedMoves";
import type { PieceValuePreset } from "@/app/utils/analysis/captureMaterial";

const cache = new WeakMap<MatchGame, Partial<Record<PieceValuePreset, Record<string, number> | null>>>();

/** Final capture balances keyed by username, independent of the displayed replay. */
export function computeGameMaterial(game: MatchGame, preset: PieceValuePreset): Record<string, number> | null {
  const cached = cache.get(game);
  if (cached && preset in cached) return cached[preset]!;
  let result: Record<string, number> | null = null;
  try {
    if (!game.partner) throw new Error("Missing partner board");
    const processed = processGameData(game.original, game.partner);
    if (processed.combinedMoves.length !== game.original.game.moveList.length / 2 + game.partner.game.moveList.length / 2) {
      throw new Error("Incomplete move timeline");
    }
    let position = createInitialPositionSnapshot();
    for (const move of reorderSimultaneousCheckmateMove(processed.combinedMoves)) {
      const applied = validateAndApplyMoveFromNotation(position, move, {
        pieceValuePreset: preset,
        bypassCheckmateCheck: true,
      });
      if (applied.type !== "ok") throw new Error("Incomplete replay");
      position = applied.next;
    }
    result = Object.create(null) as Record<string, number>;
    for (const [board, source] of [["A", game.original], ["B", game.partner]] as const) {
      for (const [side, header] of [["white", "White"], ["black", "Black"]] as const) {
        const name = source.game.pgnHeaders[header].toLowerCase();
        result[name] = (result[name] ?? 0) + position.captureMaterial[board][side];
      }
    }
  } catch {
    // Never present a partial replay as a final match total.
  }
  cache.set(game, { ...cached, [preset]: result });
  return result;
}
