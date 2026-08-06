"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import {
  buildKingHeightLeaderboard,
  type KingHeightInsightsData,
  type KingHeightLeaderboardRow,
  type KingHeightSortKey,
} from "@/app/components/player-insights/kingHeight";
import type { SortDirection } from "@/app/components/player-insights/leaderboard";
import { buildBughouseAnalysisUrl } from "@/app/utils/discovery/bughouseAnalysisUrl";

const PAGE_SIZES = [25, 50, 100] as const;
const DIGITS_ONLY = /^\d*$/;
const HEIGHT_TONES = [
  "bg-sky-400",
  "bg-cyan-400",
  "bg-teal-400",
  "bg-emerald-400",
  "bg-amber-300",
  "bg-orange-400",
  "bg-rose-400",
  "bg-fuchsia-400",
] as const;

const integerFormatter = new Intl.NumberFormat("en-GB");
const averageFormatter = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentFormatter = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 2,
});
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function distributionLabel(row: KingHeightLeaderboardRow): string {
  const buckets = row.probabilities.map(
    (probability, index) => `height ${index + 1}: ${percentFormatter.format(probability)}`,
  );
  return `${row.displayName} king height distribution; ${buckets.join("; ")}`;
}

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  if (!active) {
    return <ArrowUpDown className="h-3.5 w-3.5 opacity-45" aria-hidden="true" />;
  }
  const Icon = direction === "desc" ? ArrowDown : ArrowUp;
  return <Icon className="h-3.5 w-3.5" aria-hidden="true" />;
}

function KingHeightSortButton({
  label,
  sortKey,
  activeSortKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: KingHeightSortKey;
  activeSortKey: KingHeightSortKey;
  direction: SortDirection;
  onSort: (sortKey: KingHeightSortKey) => void;
}) {
  const active = sortKey === activeSortKey;
  return (
    <button
      type="button"
      aria-label={`Sort by ${label}`}
      aria-pressed={active}
      onClick={() => onSort(sortKey)}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/70 sm:rounded-xl sm:px-3 sm:py-2 ${
        active
          ? "border-mariner-400/60 bg-mariner-400/10 text-mariner-100"
          : "border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-600 hover:text-slate-200"
      }`}
    >
      {label}
      <SortIndicator active={active} direction={direction} />
    </button>
  );
}

function KingHeightChart({ row }: { row: KingHeightLeaderboardRow }) {
  return (
    <div
      role="img"
      aria-label={distributionLabel(row)}
      className="grid min-w-0 grid-cols-8 gap-1.5 sm:gap-2"
    >
      {row.probabilities.map((probability, index) => (
        <div key={index} className="min-w-0 text-center">
          <div className="relative mx-auto flex h-14 w-full max-w-10 items-end overflow-hidden rounded-md bg-slate-950/90 ring-1 ring-inset ring-slate-700/80">
            <div
              aria-hidden="true"
              title={`Height ${index + 1}: ${percentFormatter.format(probability)}`}
              className={`w-full rounded-t-sm ${HEIGHT_TONES[index]}`}
              style={{
                height: `${probability * 100}%`,
                minHeight: probability > 0 ? "2px" : undefined,
              }}
            />
          </div>
          <span className="mt-0.5 block font-mono text-[11px] font-medium tabular-nums text-slate-300">
            {index + 1}
          </span>
          <span className="mt-0.5 hidden font-mono text-[10px] tabular-nums text-slate-400 sm:block">
            {percentFormatter.format(probability)}
          </span>
        </div>
      ))}
    </div>
  );
}

function TouchdownGames({ row }: { row: KingHeightLeaderboardRow }) {
  const count = row.heightEightGames.length;
  if (count === 0) {
    return <span className="text-sm text-slate-500">No touchdowns</span>;
  }
  return (
    <details className="group w-full lg:relative lg:h-full lg:overflow-hidden">
      <summary className="min-h-11 shrink-0 cursor-pointer list-none rounded-lg border border-fuchsia-400/25 bg-fuchsia-400/5 px-3 py-2.5 text-sm font-medium text-fuchsia-200 outline-none transition-colors hover:border-fuchsia-400/45 focus-visible:ring-2 focus-visible:ring-fuchsia-400/60 lg:min-h-10 lg:py-2">
        {integerFormatter.format(count)} {count === 1 ? "touchdown" : "touchdowns"}
        <span className="ml-2 text-xs text-fuchsia-300/60 group-open:hidden">View</span>
      </summary>
      <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-1 lg:absolute lg:inset-x-0 lg:bottom-0 lg:top-12 lg:mt-0 lg:max-h-none">
        {row.heightEightGames.map((game, index) => {
          const date = game.endTime === null
            ? "Date unavailable"
            : dateFormatter.format(new Date(game.endTime * 1000));
          const color = game.color === "both"
            ? "Both seats"
            : game.color === "white" ? "White" : "Black";
          return (
            <li key={`${game.url}-${index}`}>
              <a
                href={buildBughouseAnalysisUrl(game.url)}
                target="_blank"
                rel="noreferrer noopener"
                className="flex min-h-10 items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-2 text-xs text-slate-300 transition-colors hover:border-slate-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/70"
              >
                <span>{date} · {color}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function KingHeightRow({ row }: { row: KingHeightLeaderboardRow }) {
  return (
    <article className="grid gap-4 border-b border-slate-800 px-4 py-4 last:border-b-0 sm:px-5 lg:h-[7.75rem] lg:grid-cols-[minmax(10rem,0.8fr)_8rem_minmax(25rem,2.2fr)_minmax(12rem,1fr)] lg:items-center lg:gap-5 lg:px-6 lg:py-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-100 sm:text-base">
          {row.displayName}
        </div>
        <div className="mt-1 font-mono text-[10px] text-slate-500">
          #{row.rank} · {integerFormatter.format(row.analyzedGames)} games
        </div>
      </div>
      <div>
        <div className="font-mono text-2xl font-semibold tabular-nums text-white">
          {row.averageHeight === null ? "—" : averageFormatter.format(row.averageHeight)}
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-slate-500">
          Average height
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between gap-3 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
          <span>Back rank</span>
          <span className="text-center text-slate-500">
            <span className="hidden sm:inline">Share of games · </span>0–100%
          </span>
          <span>Touchdown</span>
        </div>
        <KingHeightChart row={row} />
      </div>
      <div className="lg:flex lg:h-[6.25rem] lg:min-h-0 lg:items-center">
        <TouchdownGames row={row} />
      </div>
    </article>
  );
}

export default function KingHeightInsight({ data }: { data: KingHeightInsightsData }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [minimumGamesInput, setMinimumGamesInput] = useState("1000");
  const [sortKey, setSortKey] = useState<KingHeightSortKey>("average");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(25);
  const leaderboard = useMemo(() => buildKingHeightLeaderboard({
    data,
    query: deferredQuery,
    direction,
    minimumGames: minimumGamesInput === "" ? 0 : Number(minimumGamesInput),
    page,
    pageSize,
    sortKey,
  }), [data, deferredQuery, direction, minimumGamesInput, page, pageSize, sortKey]);
  const handleSort = (nextSortKey: KingHeightSortKey) => {
    if (nextSortKey === sortKey) {
      setDirection((current) => current === "desc" ? "asc" : "desc");
    } else {
      setSortKey(nextSortKey);
      setDirection("desc");
    }
    setPage(1);
  };
  const firstVisible = leaderboard.totalRows === 0
    ? 0
    : (leaderboard.page - 1) * leaderboard.pageSize + 1;
  const lastVisible = Math.min(
    leaderboard.page * leaderboard.pageSize,
    leaderboard.totalRows,
  );

  return (
    <section aria-labelledby="king-height-title" className="flex min-h-[34rem] flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 shadow-[0_24px_80px_rgba(2,6,23,0.34)] sm:rounded-2xl">
      <div className="border-b border-slate-800 px-3 py-3 sm:px-6 sm:py-5 lg:flex lg:items-end lg:justify-between lg:gap-6">
        <div className="max-w-3xl">
          <h2 id="king-height-title" className="text-base font-semibold text-slate-100 sm:text-lg">
            Average King Height
          </h2>
          <p className="mt-1 hidden text-xs leading-5 text-slate-500 sm:block sm:text-sm">
            How far each king travels from its own back rank. A playful proxy for king-danger tolerance, not a verdict on playing strength.
          </p>
        </div>
        <label className="relative mt-3 block sm:mt-4 lg:mt-0">
          <span className="sr-only">Search king height players</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search players"
            aria-label="Search king height players"
            className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950/80 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-mariner-500 focus:ring-2 focus:ring-mariner-500/20 sm:h-11 sm:w-72 sm:rounded-xl"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2 sm:gap-3 sm:px-6 sm:py-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
            Sort by
          </span>
          <div className="flex flex-wrap gap-1.5 sm:gap-2" aria-label="King height sort options">
            <KingHeightSortButton
              label="Average King Height"
              sortKey="average"
              activeSortKey={sortKey}
              direction={direction}
              onSort={handleSort}
            />
            <KingHeightSortButton
              label="Touchdowns"
              sortKey="touchdowns"
              activeSortKey={sortKey}
              direction={direction}
              onSort={handleSort}
            />
          </div>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-400 sm:gap-2">
          <span>Minimum games</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={minimumGamesInput}
            onChange={(event) => {
              if (!DIGITS_ONLY.test(event.target.value)) return;
              setMinimumGamesInput(event.target.value);
              setPage(1);
            }}
            placeholder="0"
            aria-label="Minimum player games"
            className="h-10 w-20 rounded-lg border border-slate-700 bg-slate-950 px-2.5 font-mono text-sm tabular-nums text-slate-100 outline-none placeholder:text-slate-600 focus:border-mariner-500 focus:ring-2 focus:ring-mariner-500/20 sm:w-24 sm:px-3"
          />
        </label>
      </div>

      <div className="flex-1">
        {leaderboard.rows.map((row) => <KingHeightRow key={row.username} row={row} />)}
        {leaderboard.rows.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-slate-500">
            No tracked players match the current filters.
          </p>
        ) : null}
      </div>

      <footer className="flex flex-col gap-3 border-t border-slate-800 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <span>{firstVisible}–{lastVisible} of {integerFormatter.format(leaderboard.totalRows)}</span>
          <label className="inline-flex items-center gap-2">
            <span>Rows</span>
            <select
              aria-label="King height rows per page"
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
            aria-label="Previous king height page"
            disabled={leaderboard.page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="grid h-11 w-11 place-items-center rounded-xl border border-slate-700 text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="min-w-24 text-center font-mono text-[11px] text-slate-400">
            Page {leaderboard.page} of {leaderboard.totalPages}
          </span>
          <button
            type="button"
            aria-label="Next king height page"
            disabled={leaderboard.page >= leaderboard.totalPages}
            onClick={() => setPage((current) => Math.min(leaderboard.totalPages, current + 1))}
            className="grid h-11 w-11 place-items-center rounded-xl border border-slate-700 text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 disabled:opacity-35"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </footer>
    </section>
  );
}
