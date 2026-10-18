"use client";

import { useEffect, useState } from "react";
import { APP_TOOLTIP_ID } from "@/app/utils/platform/tooltips";
import { Info } from "lucide-react";
import type { MatchGame } from "@/app/types/match";
import type { ReferenceTeams } from "./MatchNavigation";
import { computeGameMaterial } from "@/app/utils/match/matchMaterial";
import { formatSignedCaptureMaterial } from "@/app/utils/analysis/captureMaterial";
import { usePieceValuePreset } from "@/app/utils/preferences/usePieceValuePreset";

/** Compact, static full-match totals. Work is yielded between games to keep navigation responsive. */
export default function MatchMaterialSummary({ games, teams }: { games: MatchGame[]; teams: ReferenceTeams }) {
  const preset = usePieceValuePreset();
  const [result, setResult] = useState<{ games: MatchGame[]; preset: string; totals: Record<string, number> | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function calculate() {
      const totals: Record<string, number> = Object.create(null);
      for (const game of games) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        if (cancelled) return;
        const values = computeGameMaterial(game, preset);
        if (!values) {
          setResult({ games, preset, totals: null });
          return;
        }
        for (const [name, value] of Object.entries(values)) totals[name] = (totals[name] ?? 0) + value;
      }
      if (!cancelled) setResult({ games, preset, totals });
    }
    void calculate();
    return () => { cancelled = true; };
  }, [games, preset]);
  const current = result?.games === games && result.preset === preset ? result : null;
  const totals = current?.totals;
  const description = `Net capture material across all ${games.length} games, using ${preset} piece values. Fixed during replay. Captures add points; losses subtract points; drops do not change the total.`;

  return (
    <section aria-label="Match material" className="border-t border-gray-600 px-2 py-2 text-[10px]" data-testid="match-material-summary">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 font-semibold uppercase tracking-wide text-gray-300">
          Match material
          <button type="button" aria-label={description} title={description} data-tooltip-id={APP_TOOLTIP_ID} data-tooltip-content={description} className="rounded text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400">
            <Info className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
        <span className="text-gray-400">{games.length} games</span>
      </div>
      {totals ? (
        <div className="grid grid-cols-2 gap-x-4">
          {[teams.team1Display, teams.team2Display].map((names, index) => (
            <div key={index} className="min-w-0 space-y-1">
              {names.map((name) => (
                <div key={name} className="flex items-baseline justify-between gap-1">
                  <span className="truncate text-gray-300" title={name}>{name}</span>
                  <MaterialValue value={totals[name.toLowerCase()] ?? 0} />
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-1 border-t border-gray-700 pt-1">
                <span className="text-gray-400">Team total</span>
                <MaterialValue value={names.reduce((sum, name) => sum + (totals[name.toLowerCase()] ?? 0), 0)} />
              </div>
            </div>
          ))}
        </div>
      ) : <p role="status" className="text-gray-400">{current ? "Material totals unavailable for this match." : "Calculating match totals…"}</p>}
    </section>
  );
}

/** Signed numbers convey balance without relying on color alone. */
function MaterialValue({ value }: { value: number }) {
  return <span className={`shrink-0 font-semibold tabular-nums ${value > 0 ? "text-emerald-300" : value < 0 ? "text-rose-300" : "text-gray-400"}`}>{formatSignedCaptureMaterial(value)}</span>;
}
