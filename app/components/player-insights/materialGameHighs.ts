import type { PieceValuePreset } from "@/app/utils/analysis/captureMaterial";

export type MaterialGameHighDirection = "won" | "lost";
export type MaterialGameHighColor = "white" | "black" | "both";

export interface MaterialGameHigh {
  url: string;
  endTime: number | null;
  color: MaterialGameHighColor;
  fen: string;
  netMaterialX2: number;
}

export interface MaterialGameHighsData {
  schemaVersion: 1;
  dataset: {
    version: string;
    sourceSnapshotSha256: string;
    adapterPolicy: string;
    materialGameHighsAnalyzerVersion: string;
    cohortPolicy: string;
    acceptedGames: number;
    analyzedGames: number;
    replayExcludedGames: number;
    trackedPlayers: number;
  };
  presetOrder: PieceValuePreset[];
  directionOrder: MaterialGameHighDirection[];
  players: Array<{
    username: string;
    displayName: string;
    analyzedGames: number;
    gamesByPreset: Array<Record<MaterialGameHighDirection, MaterialGameHigh[]>>;
  }>;
}

export interface MaterialGameHighLeaderboardRow {
  rank: number;
  username: string;
  displayName: string;
  analyzedGames: number;
  topNetMaterial: number | null;
  games: MaterialGameHigh[];
}

export interface MaterialGameHighLeaderboardPage {
  rows: MaterialGameHighLeaderboardRow[];
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

export function buildMaterialGameHighsLeaderboard({
  data,
  preset,
  direction,
  query,
  minimumGames,
  page,
  pageSize,
}: {
  data: MaterialGameHighsData;
  preset: PieceValuePreset;
  direction: MaterialGameHighDirection;
  query: string;
  minimumGames: number;
  page: number;
  pageSize: number;
}): MaterialGameHighLeaderboardPage {
  const presetIndex = data.presetOrder.indexOf(preset);
  if (presetIndex < 0) {
    throw new Error(`Unknown material preset: ${preset}`);
  }

  const rows = data.players.map((player) => {
    const games = player.gamesByPreset[presetIndex]?.[direction] ?? [];
    return {
      username: player.username,
      displayName: player.displayName,
      analyzedGames: player.analyzedGames,
      topNetMaterial: games[0] ? games[0].netMaterialX2 / 2 : null,
      games,
    };
  });

  rows.sort((left, right) => {
    if (left.topNetMaterial === null) {
      return right.topNetMaterial === null
        ? left.username.localeCompare(right.username)
        : 1;
    }
    if (right.topNetMaterial === null) return -1;
    const scoreOrder = direction === "won"
      ? right.topNetMaterial - left.topNetMaterial
      : left.topNetMaterial - right.topNetMaterial;
    return scoreOrder || left.username.localeCompare(right.username);
  });

  const rankedRows = rows.map((row, index) => ({ ...row, rank: index + 1 }));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredRows = rankedRows.filter((row) => (
    row.analyzedGames >= minimumGames
    && (
      normalizedQuery.length === 0
      || row.username.toLocaleLowerCase().includes(normalizedQuery)
      || row.displayName.toLocaleLowerCase().includes(normalizedQuery)
    )
  ));
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pageStart = (currentPage - 1) * pageSize;

  return {
    rows: filteredRows.slice(pageStart, pageStart + pageSize),
    page: currentPage,
    pageSize,
    totalRows: filteredRows.length,
    totalPages,
  };
}
