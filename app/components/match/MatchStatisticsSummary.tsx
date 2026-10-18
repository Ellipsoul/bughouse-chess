"use client";

import { useEffect, useId, useState } from "react";
import { APP_TOOLTIP_ID } from "@/app/utils/platform/tooltips";
import { Info } from "lucide-react";
import type { MatchGame, PartnerPair } from "@/app/types/match";
import type { ReferenceTeams } from "./MatchNavigation";
import { getMatchStatistics, type MatchStatistics } from "@/app/utils/match/matchStatistics";
import { formatSignedCaptureMaterial } from "@/app/utils/analysis/captureMaterial";
import { usePieceValuePreset } from "@/app/utils/preferences/usePieceValuePreset";

/** Compact, static full-match totals. Work is yielded between games to keep navigation responsive. */
export default function MatchStatisticsSummary({ games, teams, selectedPair }: { games: MatchGame[]; teams: ReferenceTeams; selectedPair?: PartnerPair | null }) {
  const id = useId();
  const [tab, setTab] = useState<"material" | "moves">("material");
  const preset = usePieceValuePreset();
  const [result, setResult] = useState<{ games: MatchGame[]; stats: MatchStatistics | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function calculate() {
      try {
        const stats = await getMatchStatistics(games);
        if (!cancelled) setResult({ games, stats });
      } catch {
        if (!cancelled) setResult({ games, stats: null });
      }
    }
    void calculate();
    return () => { cancelled = true; };
  }, [games]);
  const current = result?.games === games ? result : null;
  const totals = current?.stats?.material[preset];
  const moves = current?.stats?.moves;
  const description = tab === "material"
    ? `Net capture material across all ${games.length} games, using ${preset} piece values. Captures add points; losses subtract points; drops do not change the total.`
    : `Moves across all ${games.length} games on source boards A and B. Each player action counts as one move, including drops. Totals stay fixed during replay.`;

  const valueFor = (name: string) => selectedPair && name === "Random opponents"
    ? Object.entries(totals ?? {}).reduce((sum, [player, value]) => sum + (selectedPair.usernames.some(n => n.toLowerCase() === player) ? 0 : value), 0)
    : totals?.[name.toLowerCase()] ?? 0;

  return (
    <section aria-label="Match statistics" className="h-32 border-t border-gray-600 px-2 py-2 text-[10px]" data-testid="match-statistics-summary">
      <div className="mb-2 flex gap-1">
        <div role="tablist" aria-label="Match statistics" className="flex flex-1 gap-1">
          {(["material", "moves"] as const).map((name, index, tabs) => (
            <button
              key={name}
              type="button"
              role="tab"
              id={`${id}-${name}-tab`}
              aria-controls={`${id}-${name}-panel`}
              aria-selected={tab === name}
              tabIndex={tab === name ? 0 : -1}
              onClick={() => setTab(name)}
              onKeyDown={event => {
                const next = event.key === "Home" ? 0 : event.key === "End" ? 1
                  : event.key === "ArrowRight" || event.key === "ArrowLeft" ? 1 - index : null;
                if (next === null) return;
                event.preventDefault();
                setTab(tabs[next]);
                document.getElementById(`${id}-${tabs[next]}-tab`)?.focus();
              }}
              className={`flex-1 rounded px-2 py-1 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400 ${tab === name ? "bg-mariner-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
            >
              {name === "material" ? "Material" : "Moves"}
            </button>
          ))}
        </div>
        <button type="button" aria-label={description} title={description} data-tooltip-id={APP_TOOLTIP_ID} data-tooltip-content={description} className="rounded px-1 text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400">
          <Info className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
      <div role="tabpanel" id={`${id}-material-panel`} aria-labelledby={`${id}-material-tab`} hidden={tab !== "material"} tabIndex={0} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400">
        {totals ? (
          <div className="grid grid-cols-2 gap-x-4">
            {(selectedPair ? [selectedPair.displayNames, ["Random opponents"]] : [teams.team1Display, teams.team2Display]).map((names, index) => (
              <div key={index} className="min-w-0 space-y-1">
                {names.map((name) => (
                  <div key={name} className="flex items-baseline justify-between gap-1">
                    <span className="truncate text-gray-300" title={name}>{name}</span>
                    <MaterialValue value={valueFor(name)} />
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-1 border-t border-gray-700 pt-1">
                  <span className="text-gray-400">Team total</span>
                  <MaterialValue value={names.reduce((sum, name) => sum + valueFor(name), 0)} />
                </div>
              </div>
            ))}
          </div>
        ) : <p role="status" className="text-gray-400">{current ? "Material totals unavailable for this match." : "Calculating match totals…"}</p>}
      </div>
      <div role="tabpanel" id={`${id}-moves-panel`} aria-labelledby={`${id}-moves-tab`} hidden={tab !== "moves"} tabIndex={0} className="space-y-1 rounded tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400">
        {moves ? (
          <>
            <div className="flex justify-between"><span className="text-gray-300">Board A</span><span className="font-semibold">{moves.A.toLocaleString("en-US")}</span></div>
            <div className="flex justify-between"><span className="text-gray-300">Board B</span><span className="font-semibold">{moves.B.toLocaleString("en-US")}</span></div>
            <div className="flex justify-between gap-2 border-t border-gray-700 pt-1"><span className="text-gray-400">Both boards · {games.length} games</span><span className="font-semibold">{(moves.A + moves.B).toLocaleString("en-US")}</span></div>
          </>
        ) : <p role="status" className="text-gray-400">{current ? "Move totals unavailable for this match." : "Calculating match totals…"}</p>}
      </div>
    </section>
  );
}

/** Signed numbers convey balance without relying on color alone. */
function MaterialValue({ value }: { value: number }) {
  return <span className={`shrink-0 font-semibold tabular-nums ${value > 0 ? "text-emerald-300" : value < 0 ? "text-rose-300" : "text-gray-400"}`}>{formatSignedCaptureMaterial(value)}</span>;
}
