"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChessBishop,
  ChessKnight,
  ChessPawn,
  ChessQueen,
  ChessRook,
  ChevronLeft,
  ChevronRight,
  Search,
  type LucideIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useDeferredValue, useMemo, useState } from "react";

import { usePieceValuePreset } from "@/app/utils/preferences/usePieceValuePreset";
import KingHeightInsight from "@/app/components/player-insights/KingHeightInsight";
import type { KingHeightInsightsData } from "@/app/components/player-insights/kingHeight";
import {
  buildMaterialLeaderboard,
  type MaterialInsight,
  type MaterialInsightsData,
  type MaterialLeaderboardRow,
  type MaterialPieceLedger,
  type MaterialPieceType,
  type MaterialSortKey,
  type SortDirection,
} from "@/app/components/player-insights/leaderboard";

const PAGE_SIZES = [25, 50, 100] as const;
type PlayerInsight = MaterialInsight | "average-king-height";
const LazyKingHeightInsight = dynamic(
  () => import("@/app/components/player-insights/KingHeightInsightData"),
  {
    loading: () => (
      <div className="grid min-h-[34rem] flex-1 place-items-center rounded-2xl border border-slate-800 bg-slate-900/40 text-sm text-slate-500">
        Loading king-height distributions…
      </div>
    ),
  },
);

const PIECE_META: Record<MaterialPieceType, { label: string; icon: LucideIcon }> = {
  pawn: { label: "Pawn", icon: ChessPawn },
  knight: { label: "Knight", icon: ChessKnight },
  bishop: { label: "Bishop", icon: ChessBishop },
  rook: { label: "Rook", icon: ChessRook },
  queen: { label: "Queen", icon: ChessQueen },
};

const INSIGHTS: Array<{
  id: PlayerInsight;
  label: string;
  description: string;
}> = [
  {
    id: "net-material",
    label: "Net Material",
    description: "Lifetime material won minus material lost across analyzed games.",
  },
  {
    id: "net-material-per-game",
    label: "Net Material per Game",
    description: "Lifetime net material divided by each player’s analyzed games.",
  },
  {
    id: "average-king-height",
    label: "Average King Height",
    description: "The furthest rank each king reaches, measured from its own back rank.",
  },
];

const integerFormatter = new Intl.NumberFormat("en-GB");
const lifetimeScoreFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});
const perGameScoreFormatter = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatSigned(value: number, mode: "integer" | "lifetime" | "per-game" = "integer"): string {
  const formatter = mode === "per-game"
    ? perGameScoreFormatter
    : mode === "lifetime"
      ? lifetimeScoreFormatter
      : integerFormatter;
  const formatted = formatter.format(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return mode === "per-game" ? formatted : "0";
}

function signedTone(value: number | null): string {
  if (value === null || value === 0) return "text-slate-400";
  return value > 0 ? "text-emerald-400" : "text-rose-400";
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

function MobileSortButton({
  label,
  sortKey,
  activeSortKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: MaterialSortKey;
  activeSortKey: MaterialSortKey;
  direction: SortDirection;
  onSort: (sortKey: MaterialSortKey) => void;
}) {
  const active = sortKey === activeSortKey;
  return (
    <button
      type="button"
      aria-label={`Sort cards by ${label}`}
      aria-pressed={active}
      onClick={() => onSort(sortKey)}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 font-mono text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/70 ${
        active
          ? "border-mariner-400/60 bg-mariner-400/10 text-mariner-200"
          : "border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-600 hover:text-slate-200"
      }`}
    >
      {label}
      <SortIndicator active={active} direction={direction} />
    </button>
  );
}

function PieceLedgerCell({
  piece,
  insight,
  analyzedGames,
}: {
  piece: MaterialPieceLedger;
  insight: MaterialInsight;
  analyzedGames: number;
}) {
  const { label, icon: Icon } = PIECE_META[piece.type];
  const perGame = insight === "net-material-per-game";
  const divisor = perGame ? analyzedGames : 1;
  const won = divisor > 0 ? piece.won / divisor : null;
  const lost = divisor > 0 ? piece.lost / divisor : null;
  const net = divisor > 0 ? piece.net / divisor : null;
  const formatCount = (value: number | null) => {
    if (value === null) return "—";
    return perGame ? perGameScoreFormatter.format(value) : integerFormatter.format(value);
  };
  const formattedNet = net === null
    ? "—"
    : formatSigned(net, perGame ? "per-game" : "integer");
  const accessibleLabel = net === null
    ? `${label} per game: no analyzed games`
    : `${label}${perGame ? " per game" : ""}: won ${formatCount(won)}, lost ${formatCount(lost)}, net ${formattedNet}`;

  return (
    <td
      aria-label={accessibleLabel}
      className="min-w-0 overflow-hidden px-1 py-2.5 align-middle lg:px-3 lg:py-3"
    >
      <div className="flex min-w-0 flex-col items-center gap-1.5 lg:min-w-24 lg:flex-row lg:items-center lg:gap-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-700/80 bg-slate-900 text-slate-300 lg:h-9 lg:w-9">
          <Icon className="h-4 w-4 lg:h-[18px] lg:w-[18px]" strokeWidth={1.7} aria-hidden="true" />
        </div>
        <div className="min-w-0 text-center lg:text-left">
          <div className={`font-mono text-xs font-semibold tabular-nums lg:text-sm ${signedTone(net)}`}>
            {formattedNet}
          </div>
          <div className="mt-0.5 flex flex-col items-center justify-center font-mono text-[8px] leading-3 tabular-nums text-slate-500 lg:flex-row lg:justify-start lg:gap-1 lg:text-[10px]">
            <span>W {formatCount(won)}</span>
            <span className="hidden lg:inline" aria-hidden="true">·</span>
            <span>L {formatCount(lost)}</span>
          </div>
        </div>
      </div>
    </td>
  );
}

function LeaderboardRow({
  row,
  insight,
}: {
  row: MaterialLeaderboardRow;
  insight: MaterialInsight;
}) {
  const score = row.score === null
    ? "—"
    : insight === "net-material-per-game"
      ? formatSigned(row.score, "per-game")
      : formatSigned(row.score, "lifetime");

  return (
    <tr className="mb-3 grid grid-cols-5 gap-x-1 rounded-xl border border-slate-800 bg-slate-900/70 px-2 py-2 shadow-[0_12px_30px_rgba(2,6,23,0.18)] transition-colors hover:border-slate-700 lg:mb-0 lg:table-row lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none lg:hover:bg-slate-800/45">
      <td className="hidden w-14 px-4 py-3 text-center font-mono text-xs tabular-nums text-slate-500 lg:table-cell">
        {row.rank}
      </td>
      <th scope="row" className="col-span-3 min-w-0 px-2 py-2 text-left lg:table-cell lg:w-52 lg:px-4 lg:py-3">
        <div className="truncate text-sm font-semibold text-slate-100 lg:text-[15px]">
          {row.displayName}
        </div>
        <div className="mt-0.5 truncate font-mono text-[10px] text-slate-500">
          #{row.rank}
        </div>
      </th>
      <td className="col-span-2 px-2 py-2 text-right align-middle lg:table-cell lg:w-36 lg:px-4 lg:py-3">
        <div className={`font-mono text-lg font-semibold tabular-nums lg:text-base ${signedTone(row.score)}`}>
          {score}
        </div>
        <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-600 lg:hidden">
          {insight === "net-material" ? "net" : "per game"}
        </div>
      </td>
      <td className="col-span-5 flex items-center justify-between border-y border-slate-800/80 px-2 py-2 text-xs text-slate-400 lg:table-cell lg:w-28 lg:border-0 lg:px-4 lg:py-3">
        <span className="lg:hidden">Analyzed games</span>
        <span className="font-mono tabular-nums text-slate-300">
          {integerFormatter.format(row.analyzedGames)}
        </span>
      </td>
      {row.pieces.map((piece) => (
        <PieceLedgerCell
          key={piece.type}
          piece={piece}
          insight={insight}
          analyzedGames={row.analyzedGames}
        />
      ))}
    </tr>
  );
}

export default function PlayerInsightsPageClient({
  data,
  kingHeightData,
}: {
  data: MaterialInsightsData;
  kingHeightData?: KingHeightInsightsData;
}) {
  const preset = usePieceValuePreset();
  const [insight, setInsight] = useState<PlayerInsight>("net-material");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [sortKey, setSortKey] = useState<MaterialSortKey>("net");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(25);
  const materialInsight: MaterialInsight = insight === "average-king-height"
    ? "net-material"
    : insight;

  const leaderboard = useMemo(() => buildMaterialLeaderboard({
    data,
    preset,
    insight: materialInsight,
    query: deferredQuery,
    sortKey,
    direction,
    page,
    pageSize,
  }), [data, deferredQuery, direction, materialInsight, page, pageSize, preset, sortKey]);

  const handleSort = (nextSortKey: MaterialSortKey) => {
    if (nextSortKey === sortKey) {
      setDirection((current) => current === "desc" ? "asc" : "desc");
    } else {
      setSortKey(nextSortKey);
      setDirection("desc");
    }
    setPage(1);
  };

  const selectedInsight = INSIGHTS.find((item) => item.id === insight) ?? INSIGHTS[0];
  const firstVisible = leaderboard.totalRows === 0
    ? 0
    : (leaderboard.page - 1) * leaderboard.pageSize + 1;
  const lastVisible = Math.min(
    leaderboard.page * leaderboard.pageSize,
    leaderboard.totalRows,
  );

  return (
    <main className="h-full overflow-y-auto bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-full w-full max-w-[1680px] flex-col px-3 py-3 sm:px-5 sm:py-5 md:px-7 lg:px-10 lg:py-8">
        <header className="border-b border-slate-800/90 pb-4 sm:pb-6 lg:flex lg:items-end lg:justify-between lg:gap-10 lg:pb-8">
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-mariner-400 sm:text-xs">
              Permanent cohort<span className="hidden sm:inline"> · lifetime ledger</span>
            </p>
            <h1 className="mt-1.5 font-serif text-3xl font-semibold tracking-[-0.025em] text-white sm:mt-2 sm:text-4xl lg:text-5xl">
              Player Insights
            </h1>
            <p className="mt-3 hidden max-w-2xl text-sm leading-6 text-slate-400 sm:block sm:text-base">
              Compare playful lifetime patterns across every permanently tracked player in the archive.
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px] text-slate-400 sm:mt-5 sm:gap-x-5 sm:gap-y-2 lg:mt-0 lg:justify-end">
            <span>{integerFormatter.format(data.dataset.trackedPlayers)} permanently tracked players</span>
            <span>{integerFormatter.format(data.dataset.analyzedGames)} games analyzed</span>
            {insight === "average-king-height" ? null : (
              <span className="text-mariner-300">
                {preset === "bughouse" ? "Bughouse" : "Standard"} values
              </span>
            )}
          </div>
        </header>

        <nav aria-label="Player Insights" className="flex flex-wrap gap-1.5 py-3 sm:gap-2 sm:py-5 lg:py-6">
          {INSIGHTS.map((item) => {
            const active = item.id === insight;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setInsight(item.id);
                  setPage(1);
                }}
                className={`min-h-11 rounded-full border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/70 sm:px-4 ${
                  active
                    ? "border-mariner-400/70 bg-mariner-400/10 text-mariner-100"
                    : "border-slate-700 bg-slate-900/70 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {insight === "average-king-height" ? (
          kingHeightData
            ? <KingHeightInsight data={kingHeightData} />
            : <LazyKingHeightInsight />
        ) : (
        <section aria-labelledby="leaderboard-title" className="flex min-h-[34rem] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 shadow-[0_24px_80px_rgba(2,6,23,0.34)]">
          <div className="border-b border-slate-800 px-3 py-4 sm:px-5 lg:flex lg:items-end lg:justify-between lg:gap-6 lg:px-6 lg:py-5">
            <div>
              <h2 id="leaderboard-title" className="text-lg font-semibold text-slate-100">
                {selectedInsight.label}
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                {selectedInsight.description}
              </p>
            </div>
            <div className="mt-4 lg:mt-0">
              <label className="relative block">
                <span className="sr-only">Search players</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search players"
                  aria-label="Search players"
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950/80 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-mariner-500 focus:ring-2 focus:ring-mariner-500/20 sm:w-72"
                />
              </label>
            </div>
          </div>

          <div className="border-b border-slate-800 px-3 py-3 lg:hidden">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
                Sort by
              </span>
              <span className="text-[10px] text-slate-600">
                Tap again to reverse
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pb-1">
              <MobileSortButton
                label="Net"
                sortKey="net"
                activeSortKey={sortKey}
                direction={direction}
                onSort={handleSort}
              />
              <MobileSortButton
                label="Games"
                sortKey="games"
                activeSortKey={sortKey}
                direction={direction}
                onSort={handleSort}
              />
              {data.pieceOrder.map((pieceType) => (
                <MobileSortButton
                  key={pieceType}
                  label={PIECE_META[pieceType].label}
                  sortKey={pieceType}
                  activeSortKey={sortKey}
                  direction={direction}
                  onSort={handleSort}
                />
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-x-auto px-3 py-3 lg:px-0 lg:py-0">
            <table aria-label="Player material leaderboard" className="block w-full border-separate border-spacing-0 lg:table lg:min-w-[1180px]">
              <thead className="hidden bg-slate-950/75 lg:table-header-group">
                <tr>
                  <th scope="col" className="border-b border-slate-800 px-4 py-3 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Rank</th>
                  <th scope="col" className="border-b border-slate-800 px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Player</th>
                  <th
                    scope="col"
                    aria-sort={sortKey === "net" ? (direction === "desc" ? "descending" : "ascending") : undefined}
                    className="border-b border-slate-800 p-0 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500"
                  >
                    <button
                      type="button"
                      aria-label="Sort by Net material"
                      aria-pressed={sortKey === "net"}
                      onClick={() => handleSort("net")}
                      className={`inline-flex min-h-11 w-full items-center justify-end gap-1.5 px-4 py-3 transition-colors hover:bg-slate-800/60 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mariner-400/70 ${
                        sortKey === "net" ? "text-mariner-300" : "text-slate-500"
                      }`}
                    >
                      {materialInsight === "net-material" ? "Net" : "Per game"}
                      <SortIndicator active={sortKey === "net"} direction={direction} />
                    </button>
                  </th>
                  <th
                    scope="col"
                    aria-sort={sortKey === "games" ? (direction === "desc" ? "descending" : "ascending") : undefined}
                    className="border-b border-slate-800 p-0 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500"
                  >
                    <button
                      type="button"
                      aria-label="Sort by Games"
                      aria-pressed={sortKey === "games"}
                      onClick={() => handleSort("games")}
                      className={`inline-flex min-h-11 w-full items-center justify-end gap-1.5 px-4 py-3 transition-colors hover:bg-slate-800/60 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mariner-400/70 ${
                        sortKey === "games" ? "text-mariner-300" : "text-slate-500"
                      }`}
                    >
                      Games
                      <SortIndicator active={sortKey === "games"} direction={direction} />
                    </button>
                  </th>
                  {data.pieceOrder.map((pieceType) => {
                    const { label, icon: Icon } = PIECE_META[pieceType];
                    return (
                      <th
                        key={pieceType}
                        scope="col"
                        aria-sort={sortKey === pieceType ? (direction === "desc" ? "descending" : "ascending") : undefined}
                        className="border-b border-slate-800 p-0 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500"
                      >
                        <button
                          type="button"
                          aria-label={`Sort by ${label}`}
                          aria-pressed={sortKey === pieceType}
                          onClick={() => handleSort(pieceType)}
                          className={`inline-flex min-h-11 w-full items-center gap-1.5 px-3 py-3 transition-colors hover:bg-slate-800/60 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mariner-400/70 ${
                            sortKey === pieceType ? "text-mariner-300" : "text-slate-500"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                          {label}
                          <SortIndicator active={sortKey === pieceType} direction={direction} />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="block lg:table-row-group">
                {leaderboard.rows.map((row) => (
                  <LeaderboardRow key={row.username} row={row} insight={materialInsight} />
                ))}
                {leaderboard.rows.length === 0 ? (
                  <tr className="block lg:table-row">
                    <td colSpan={9} className="block px-5 py-16 text-center text-sm text-slate-500 lg:table-cell">
                      No tracked players match “{deferredQuery.trim()}”.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <footer className="flex flex-col gap-3 border-t border-slate-800 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-3">
              <span>
                {firstVisible}–{lastVisible} of {integerFormatter.format(leaderboard.totalRows)}
              </span>
              <label className="inline-flex items-center gap-2">
                <span>Rows</span>
                <select
                  aria-label="Rows per page"
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
                aria-label="Previous page"
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
                aria-label="Next page"
                disabled={leaderboard.page >= leaderboard.totalPages}
                onClick={() => setPage((current) => Math.min(leaderboard.totalPages, current + 1))}
                className="grid h-11 w-11 place-items-center rounded-xl border border-slate-700 text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 disabled:opacity-35"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </footer>
        </section>
        )}
      </div>
    </main>
  );
}
