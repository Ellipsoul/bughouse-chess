"use client";

import { ChevronLeft, ChevronRight, ExternalLink, Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import StaticChessBoard from "@/app/components/board/StaticChessBoard";
import {
  buildMaterialGameHighsLeaderboard,
  type MaterialGameHigh,
  type MaterialGameHighDirection,
  type MaterialGameHighsData,
} from "@/app/components/player-insights/materialGameHighs";
import type { PieceValuePreset } from "@/app/utils/analysis/captureMaterial";
import { buildBughouseAnalysisUrl } from "@/app/utils/discovery/bughouseAnalysisUrl";

const PAGE_SIZES = [25, 50, 100] as const;
const integerFormatter = new Intl.NumberFormat("en-GB");
const materialFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatMaterial(netMaterialX2: number): string {
  const value = netMaterialX2 / 2;
  const absolute = materialFormatter.format(Math.abs(value));
  return value > 0 ? `+${absolute}` : `−${absolute}`;
}

function StaticFinalBoard({
  game,
  playerName,
  rank,
}: {
  game: MaterialGameHigh;
  playerName: string;
  rank: number;
}) {
  return (
    <StaticChessBoard
      fen={game.fen}
      orientation={game.color === "black" ? "black" : "white"}
      label={`Final position for ${playerName}'s #${rank} material game, viewed as ${game.color}`}
    />
  );
}

function GameCard({
  game,
  playerName,
  rank,
}: {
  game: MaterialGameHigh;
  playerName: string;
  rank: number;
}) {
  const date = game.endTime === null
    ? "Date unavailable"
    : dateFormatter.format(new Date(game.endTime * 1000));
  return (
    <div className="w-[17rem] rounded-xl border border-slate-800 bg-slate-950/65 p-3 sm:w-[19rem] lg:w-auto">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
            #{rank} · {date}
          </p>
          <p className={`mt-0.5 font-mono text-lg font-semibold ${
            game.netMaterialX2 > 0 ? "text-emerald-400" : "text-rose-400"
          }`}>
            {formatMaterial(game.netMaterialX2)}
          </p>
        </div>
        <span className="rounded-full border border-slate-700 px-1.5 py-0.5 text-[9px] uppercase text-slate-500">
          {game.color === "both" ? "Both" : game.color === "white" ? "White" : "Black"}
        </span>
      </div>
      <StaticFinalBoard game={game} playerName={playerName} rank={rank} />
      <a
        href={buildBughouseAnalysisUrl(game.url)}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={`Open #${rank} in Relay for ${playerName}`}
        className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 text-[10px] font-medium text-slate-300 transition-colors hover:border-mariner-500/70 hover:text-mariner-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/70"
      >
        Open in Relay
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
    </div>
  );
}

export default function MaterialGameHighsInsight({
  data,
  preset,
}: {
  data: MaterialGameHighsData;
  preset: PieceValuePreset;
}) {
  const [direction, setDirection] = useState<MaterialGameHighDirection>("won");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [minimumGamesInput, setMinimumGamesInput] = useState("0");
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(25);
  const [page, setPage] = useState(1);
  const minimumGames = minimumGamesInput === "" ? 0 : Number(minimumGamesInput);

  const leaderboard = useMemo(() => buildMaterialGameHighsLeaderboard({
    data,
    preset,
    direction,
    query: deferredQuery,
    minimumGames,
    page,
    pageSize,
  }), [data, deferredQuery, direction, minimumGames, page, pageSize, preset]);

  const firstVisible = leaderboard.totalRows === 0
    ? 0
    : (leaderboard.page - 1) * leaderboard.pageSize + 1;
  const lastVisible = Math.min(
    leaderboard.page * leaderboard.pageSize,
    leaderboard.totalRows,
  );

  const selectDirection = (nextDirection: MaterialGameHighDirection) => {
    setDirection(nextDirection);
    setPage(1);
  };

  return (
    <section aria-labelledby="material-game-highs-title" className="flex min-h-[34rem] flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 shadow-[0_24px_80px_rgba(2,6,23,0.34)] sm:rounded-2xl">
      <div className="border-b border-slate-800 px-3 py-4 sm:px-5 lg:flex lg:items-end lg:justify-between lg:gap-6 lg:px-6 lg:py-5">
        <div className="max-w-2xl">
          <h2 id="material-game-highs-title" className="text-base font-semibold text-slate-100 sm:text-lg">
            Material Game Highs
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
            Each player’s three most extreme single-game net material results.
          </p>
        </div>
        <div className="mt-3 flex rounded-xl border border-slate-700 bg-slate-950/70 p-1 lg:mt-0" aria-label="Material game-high direction">
          {(["won", "lost"] as const).map((value) => {
            const active = direction === value;
            const label = value === "won" ? "Most won" : "Most lost";
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => selectDirection(value)}
                className={`min-h-10 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/70 sm:px-4 ${
                  active
                    ? "bg-mariner-500/15 text-mariner-100"
                    : "text-slate-500 hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-800 px-3 py-3 sm:px-5 lg:px-6">
        <label className="relative min-w-52 flex-1 sm:max-w-72">
          <span className="sr-only">Search game-high players</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            aria-label="Search game-high players"
            placeholder="Search players"
            className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950/80 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-mariner-500 focus:ring-2 focus:ring-mariner-500/20"
          />
        </label>
        <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/80 px-3 text-xs text-slate-500">
          <span>Min games</span>
          <input
            type="text"
            inputMode="numeric"
            aria-label="Minimum analyzed games"
            value={minimumGamesInput}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "" || /^\d+$/.test(value)) {
                setMinimumGamesInput(value);
                setPage(1);
              }
            }}
            className="w-16 bg-transparent text-right font-mono text-sm text-slate-200 outline-none"
          />
        </label>
      </div>

      <div className="flex-1 divide-y divide-slate-800/80">
        {leaderboard.rows.map((row) => (
          <article
            key={row.username}
            className="px-3 py-4 sm:px-5 lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-5 lg:px-6"
            style={{ contentVisibility: "auto", containIntrinsicSize: "440px" }}
          >
            <div className="mb-3 flex items-start justify-between gap-3 lg:mb-0 lg:block">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">
                  Rank {integerFormatter.format(row.rank)}
                </p>
                <h3 className="mt-1 break-words text-sm font-semibold text-slate-100 sm:text-base">
                  {row.displayName}
                </h3>
                {row.displayName.toLocaleLowerCase() !== row.username ? (
                  <p className="mt-0.5 break-all font-mono text-[10px] text-slate-600">@{row.username}</p>
                ) : null}
              </div>
              <p className="shrink-0 font-mono text-[10px] text-slate-500 lg:mt-3">
                {integerFormatter.format(row.analyzedGames)} games
              </p>
            </div>
            {row.games.length > 0 ? (
              <div className="max-w-full overflow-x-auto pb-1">
                <div className="grid w-max grid-flow-col auto-cols-[17rem] gap-3 sm:auto-cols-[19rem] lg:w-full lg:grid-flow-row lg:grid-cols-3 lg:auto-cols-auto lg:gap-3">
                  {row.games.map((game, index) => (
                    <GameCard
                      key={`${game.url}-${index}`}
                      game={game}
                      playerName={row.displayName}
                      rank={index + 1}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-slate-800 bg-slate-950/35 text-xs text-slate-600">
                No qualifying game
              </div>
            )}
          </article>
        ))}
        {leaderboard.rows.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-slate-500">
            No tracked players match these filters.
          </div>
        ) : null}
      </div>

      <footer className="flex flex-col gap-3 border-t border-slate-800 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <span>{firstVisible}–{lastVisible} of {integerFormatter.format(leaderboard.totalRows)}</span>
          <label className="inline-flex items-center gap-2">
            <span>Rows</span>
            <select
              aria-label="Game-high rows per page"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value) as (typeof PAGE_SIZES)[number]);
                setPage(1);
              }}
              className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-slate-300 outline-none focus:border-mariner-500"
            >
              {PAGE_SIZES.map((size) => <option key={size}>{size}</option>)}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <button
            type="button"
            aria-label="Previous game-high page"
            disabled={leaderboard.page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="grid h-11 w-11 place-items-center rounded-xl border border-slate-700 text-slate-300 disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="min-w-24 text-center font-mono text-[11px] text-slate-400">
            Page {leaderboard.page} of {leaderboard.totalPages}
          </span>
          <button
            type="button"
            aria-label="Next game-high page"
            disabled={leaderboard.page >= leaderboard.totalPages}
            onClick={() => setPage((current) => Math.min(leaderboard.totalPages, current + 1))}
            className="grid h-11 w-11 place-items-center rounded-xl border border-slate-700 text-slate-300 disabled:opacity-35"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </footer>
    </section>
  );
}
