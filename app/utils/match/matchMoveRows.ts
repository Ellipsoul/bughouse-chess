import type { MatchGame, PartnerPair } from '@/app/types/match';

/** Attribute board actions by players, even when source A/B changes between games. */
export function matchMoveRows(games: MatchGame[], selectedPair?: PartnerPair | null) {
  const rows = new Map<string, { label: string; count: number }>();
  for (const game of games) {
    for (const source of [game.original, game.partner]) {
      const names = [source.game.pgnHeaders.White, source.game.pgnHeaders.Black];
      const selected = selectedPair?.usernames.findIndex(name => names.some(n => n.toLowerCase() === name.toLowerCase())) ?? -1;
      const ordered = [...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      const key = selectedPair && selected >= 0 ? selectedPair.usernames[selected].toLowerCase() : JSON.stringify(ordered.map(n => n.toLowerCase()));
      const label = selectedPair && selected >= 0 ? selectedPair.displayNames[selected] : ordered.join(' / ');
      const row = rows.get(key) ?? { label, count: 0 };
      row.count += source.game.moveList.length / 2;
      rows.set(key, row);
    }
  }
  return [...rows.values()];
}
