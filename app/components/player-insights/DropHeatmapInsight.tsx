"use client";

import {
  ChessBishop,
  ChessKnight,
  ChessPawn,
  ChessQueen,
  ChessRook,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import { memo, useMemo, useState } from "react";

import {
  deriveDropHeatmapRow,
  deriveTrackedCohortDropHeatmapRow,
  type DropColorMode,
  type DropHeatmapInsightsData,
  type DropHeatmapRow,
  type DropPieceType,
} from "@/app/components/player-insights/dropHeatmaps";

const WHITE_BOARD_INDEX_ORDER = Array.from(
  { length: 64 },
  (_, index) => (7 - Math.floor(index / 8)) * 8 + (index % 8),
);

const PIECE_META: Record<
  DropPieceType,
  { label: string; icon: LucideIcon; heat: string; border: string; text: string }
> = {
  pawn: {
    label: "Pawn",
    icon: ChessPawn,
    heat: "45, 212, 191",
    border: "border-teal-400/30",
    text: "text-teal-200",
  },
  knight: {
    label: "Knight",
    icon: ChessKnight,
    heat: "56, 189, 248",
    border: "border-sky-400/30",
    text: "text-sky-200",
  },
  bishop: {
    label: "Bishop",
    icon: ChessBishop,
    heat: "167, 139, 250",
    border: "border-violet-400/30",
    text: "text-violet-200",
  },
  rook: {
    label: "Rook",
    icon: ChessRook,
    heat: "251, 191, 36",
    border: "border-amber-400/30",
    text: "text-amber-200",
  },
  queen: {
    label: "Queen",
    icon: ChessQueen,
    heat: "244, 114, 182",
    border: "border-pink-400/30",
    text: "text-pink-200",
  },
};

const COLOR_MODES: Array<{ id: DropColorMode; label: string }> = [
  { id: "combined", label: "Combined" },
  { id: "white", label: "White" },
  { id: "black", label: "Black" },
];

const integerFormatter = new Intl.NumberFormat("en-GB");
const percentFormatter = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 2,
});

function formatPercent(probability: number): string {
  return probability > 0 && probability < 0.0001
    ? "<0.01%"
    : percentFormatter.format(probability);
}

const DropBoard = memo(function DropBoard({
  row,
  pieceType,
  pieceIndex,
  squareOrder,
  showHeader = true,
  className = "w-full min-w-63",
}: {
  row: DropHeatmapRow;
  pieceType: DropPieceType;
  pieceIndex: number;
  squareOrder: string[];
  showHeader?: boolean;
  className?: string;
}) {
  const meta = PIECE_META[pieceType];
  const Icon = meta.icon;
  const counts = row.drops[pieceIndex];
  const probabilities = row.probabilities[pieceIndex];
  const maximumProbability = Math.max(...probabilities);

  return (
    <section className={`${className} overflow-hidden rounded-xl border bg-slate-950/70 ${meta.border}`}>
      {showHeader ? (
        <div className="flex h-10 items-center justify-between gap-2 border-b border-slate-800/90 px-2.5">
          <span className={`inline-flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${meta.text}`}>
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {meta.label}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-slate-500">
            {integerFormatter.format(row.pieceTotals[pieceIndex])}
          </span>
        </div>
      ) : null}
      <div
        role="grid"
        aria-label={`${row.displayName} ${meta.label} drop heat map`}
        className="grid aspect-square grid-cols-8 overflow-hidden"
      >
        {WHITE_BOARD_INDEX_ORDER.map((squareIndex, boardIndex) => {
          const count = counts[squareIndex];
          const probability = probabilities[squareIndex];
          const square = squareOrder[squareIndex];
          const relativeIntensity = maximumProbability === 0
            ? 0
            : probability / maximumProbability;
          const alpha = count === 0 ? 0 : 0.24 + relativeIntensity * 0.7;
          const checkerTone = (
            (Math.floor(boardIndex / 8) + (boardIndex % 8)) % 2 === 0
              ? "#1e293b"
              : "#0f172a"
          );
          const percentage = formatPercent(probability);
          const dropLabel = `${integerFormatter.format(count)} ${count === 1 ? "drop" : "drops"}`;
          const label = `${square}: ${dropLabel}, ${percentage}`;
          return (
            <div
              key={square}
              role="gridcell"
              aria-label={label}
              title={label}
              className="grid aspect-square place-content-center overflow-hidden font-mono text-[7px] font-semibold leading-[0.95] tabular-nums text-white [text-shadow:0_1px_2px_rgb(2_6_23)] sm:text-[8px]"
              style={{
                background: count === 0
                  ? checkerTone
                  : `linear-gradient(rgba(${meta.heat}, ${alpha}), rgba(${meta.heat}, ${alpha})), ${checkerTone}`,
              }}
            >
              {count > 0 ? (
                <>
                  <span>{integerFormatter.format(count)}</span>
                  <span>{percentage}</span>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
});

function DropBoardGallery({
  row,
  data,
}: {
  row: DropHeatmapRow;
  data: DropHeatmapInsightsData;
}) {
  return (
    <article
      aria-label={`${row.displayName} drop heat maps`}
      className="px-2 py-3 sm:px-3 sm:py-4"
    >
      <div className="mb-3 flex min-w-0 items-baseline justify-between gap-3 px-1">
        <div className="truncate text-sm font-semibold text-slate-100 sm:text-base">
          {row.displayName}
        </div>
        <div className="shrink-0 font-mono text-[10px] tabular-nums text-slate-500">
          {integerFormatter.format(row.representedGames)} games
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-1">
        {data.pieceOrder.map((pieceType, pieceIndex) => (
          <DropBoard
            key={pieceType}
            row={row}
            pieceType={pieceType}
            pieceIndex={pieceIndex}
            squareOrder={data.squareOrder}
            className="w-full min-w-62 max-w-md flex-[1_1_15.5rem]"
          />
        ))}
      </div>
    </article>
  );
}

function ColorModeControl({
  colorMode,
  onChange,
}: {
  colorMode: DropColorMode;
  onChange: (mode: DropColorMode) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-slate-700 bg-slate-950/80 p-1" aria-label="Drop color mode">
      {COLOR_MODES.map((mode) => (
        <button
          key={mode.id}
          type="button"
          aria-label={`${mode.label} drops`}
          aria-pressed={colorMode === mode.id}
          onClick={() => onChange(mode.id)}
          className={`min-h-9 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/70 ${
            colorMode === mode.id
              ? "bg-mariner-400/15 text-mariner-100 shadow-sm"
              : "text-slate-500 hover:text-slate-200"
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

export default function DropHeatmapInsight({ data }: { data: DropHeatmapInsightsData }) {
  const [query, setQuery] = useState("");
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1);
  const [colorMode, setColorMode] = useState<DropColorMode>("combined");
  const playerByUsername = useMemo(() => new Map(
    data.players.map((player) => [player.username, player]),
  ), [data.players]);
  const cohortRow = useMemo(() => (
    deriveTrackedCohortDropHeatmapRow(data, colorMode)
  ), [colorMode, data]);
  const selectedRows = useMemo(() => selectedUsernames.flatMap((username) => {
    const player = playerByUsername.get(username);
    return player ? [deriveDropHeatmapRow(player, colorMode)] : [];
  }), [colorMode, playerByUsername, selectedUsernames]);
  const galleryRow = selectedRows[0] ?? cohortRow;
  const suggestions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (normalizedQuery.length === 0) return [];
    const selected = new Set(selectedUsernames);
    return data.players
      .filter((player) => (
        !selected.has(player.username)
        && (
          player.username.toLocaleLowerCase().includes(normalizedQuery)
          || player.displayName.toLocaleLowerCase().includes(normalizedQuery)
        )
      ))
      .map((player) => deriveDropHeatmapRow(player, colorMode))
      .sort((left, right) => (
        right.representedGames - left.representedGames
        || left.username.localeCompare(right.username)
      ))
      .slice(0, 8);
  }, [colorMode, data.players, query, selectedUsernames]);
  const changeColorMode = (mode: DropColorMode) => {
    setColorMode(mode);
  };
  const selectPlayer = (username: string) => {
    setSelectedUsernames((current) => [...current, username]);
    setQuery("");
    setHighlightedSuggestionIndex(-1);
  };

  return (
    <section aria-labelledby="drop-heatmap-title" className="flex min-h-136 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 shadow-[0_24px_80px_rgba(2,6,23,0.34)] sm:rounded-2xl">
      <div className="border-b border-slate-800 px-3 py-3 sm:px-6 sm:py-5 lg:flex lg:items-end lg:justify-between lg:gap-6">
        <div className="max-w-3xl">
          <h2 id="drop-heatmap-title" className="text-base font-semibold text-slate-100 sm:text-lg">
            Piece Drop Heat Maps
          </h2>
          <p className="mt-1 hidden text-xs leading-5 text-slate-500 sm:block sm:text-sm">
            Explore the permanent cohort, then compare individual players.
          </p>
        </div>
        <div className="relative mt-3 sm:mt-4 lg:mt-0">
          <label className="relative block">
            <span className="sr-only">Add players to comparison</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              type="text"
              role="combobox"
              aria-label="Add players to comparison"
              aria-expanded={suggestions.length > 0}
              aria-controls="drop-player-suggestions"
              aria-autocomplete="list"
              aria-activedescendant={
                highlightedSuggestionIndex >= 0
                  && highlightedSuggestionIndex < suggestions.length
                  ? `drop-player-suggestion-${highlightedSuggestionIndex}`
                  : undefined
              }
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlightedSuggestionIndex(-1);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && suggestions.length > 0) {
                  event.preventDefault();
                  setHighlightedSuggestionIndex((current) => (
                    current < suggestions.length - 1 ? current + 1 : 0
                  ));
                } else if (event.key === "ArrowUp" && suggestions.length > 0) {
                  event.preventDefault();
                  setHighlightedSuggestionIndex((current) => (
                    current > 0 ? current - 1 : suggestions.length - 1
                  ));
                } else if (
                  event.key === "Enter"
                  && highlightedSuggestionIndex >= 0
                  && highlightedSuggestionIndex < suggestions.length
                ) {
                  event.preventDefault();
                  selectPlayer(suggestions[highlightedSuggestionIndex].username);
                } else if (event.key === "Escape") {
                  setHighlightedSuggestionIndex(-1);
                }
              }}
              placeholder="Find and add players"
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950/80 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-mariner-500 focus:ring-2 focus:ring-mariner-500/20 sm:h-11 sm:w-72 sm:rounded-xl"
            />
          </label>
          {suggestions.length > 0 ? (
            <ul id="drop-player-suggestions" role="listbox" className="absolute inset-x-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-1.5 shadow-2xl shadow-slate-950/70">
              {suggestions.map((player, suggestionIndex) => (
                <li key={player.username}>
                  <button
                    id={`drop-player-suggestion-${suggestionIndex}`}
                    type="button"
                    role="option"
                    aria-selected={highlightedSuggestionIndex === suggestionIndex}
                    onMouseEnter={() => setHighlightedSuggestionIndex(suggestionIndex)}
                    onClick={() => selectPlayer(player.username)}
                    className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/70 ${
                      highlightedSuggestionIndex === suggestionIndex
                        ? "bg-slate-800"
                        : "hover:bg-slate-800"
                    }`}
                  >
                    <span className="truncate text-sm font-medium text-slate-200">
                      {player.displayName}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-500">
                      {integerFormatter.format(player.representedGames)} games
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-950/25 px-3 py-2.5 sm:gap-3 sm:px-6">
        <ColorModeControl colorMode={colorMode} onChange={changeColorMode} />
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-slate-600 sm:inline">
          {colorMode === "combined" ? "Black ranks reflected" : `${colorMode} source squares`}
        </span>
        {selectedRows.length > 0 ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:gap-2">
            {selectedRows.map((row) => (
              <button
                key={row.username}
                type="button"
                aria-label={`Remove ${row.displayName} from comparison`}
                onClick={() => setSelectedUsernames((current) => (
                  current.filter((username) => username !== row.username)
                ))}
                className="inline-flex min-h-9 max-w-48 items-center gap-1.5 rounded-full border border-mariner-400/25 bg-mariner-400/10 px-2.5 text-xs text-mariner-100 transition-colors hover:border-mariner-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/70"
              >
                <span className="truncate">{row.displayName}</span>
                <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </button>
            ))}
            {selectedRows.length > 1 ? (
              <button
                type="button"
                onClick={() => setSelectedUsernames([])}
                className="min-h-9 px-2 text-xs text-slate-500 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/70"
              >
                Clear all
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {selectedRows.length > 1 ? (
        <div role="region" aria-label="Selected player drop comparison" className="flex-1 overflow-x-auto px-2 py-4 sm:py-5">
          <div className="grid w-full min-w-348 grid-cols-5 items-start gap-2 pr-1">
            {data.pieceOrder.map((pieceType, pieceIndex) => {
              const meta = PIECE_META[pieceType];
              const Icon = meta.icon;
              return (
                <section key={pieceType} role="group" aria-label={`${meta.label} comparisons`} className={`w-full min-w-68 overflow-hidden rounded-xl border bg-slate-950/35 ${meta.border}`}>
                  <div className={`flex h-11 items-center gap-2 border-b border-slate-800 px-3 text-xs font-semibold uppercase tracking-widest ${meta.text}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {meta.label}
                  </div>
                  <div className="divide-y divide-slate-800">
                    {selectedRows.map((row) => (
                      <div key={row.username} className="p-2">
                        <div className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
                          <span className="max-w-24 truncate text-[11px] font-semibold text-slate-200">
                            {row.displayName}
                          </span>
                          <span className="shrink-0 font-mono text-[8px] tabular-nums text-slate-600">
                            {integerFormatter.format(row.representedGames)}g
                          </span>
                        </div>
                        <DropBoard
                          row={row}
                          pieceType={pieceType}
                          pieceIndex={pieceIndex}
                          squareOrder={data.squareOrder}
                          showHeader={false}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1">
          <DropBoardGallery row={galleryRow} data={data} />
        </div>
      )}
    </section>
  );
}
