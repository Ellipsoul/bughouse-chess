import type { PieceValuePreset } from "@/app/utils/analysis/captureMaterial";

export type MaterialPieceType = "pawn" | "knight" | "bishop" | "rook" | "queen";
export type MaterialInsight = "net-material" | "net-material-per-game";
export type MaterialSortKey = "net" | "games" | MaterialPieceType;
export type SortDirection = "asc" | "desc";

export interface MaterialInsightsData {
  schemaVersion: 1;
  dataset: {
    version: string;
    sourceSnapshotSha256: string;
    adapterPolicy: string;
    analyzerVersion: string;
    cohortPolicy: string;
    acceptedGames: number;
    analyzedGames: number;
    replayExcludedGames: number;
    trackedPlayers: number;
  };
  pieceOrder: MaterialPieceType[];
  pieceValues: Record<PieceValuePreset, number[]>;
  players: Array<{
    username: string;
    displayName: string;
    eligibleGames: number;
    analyzedGames: number;
    replayExcludedGames: number;
    pieces: Array<[number, number]>;
  }>;
}

export interface MaterialPieceLedger {
  type: MaterialPieceType;
  won: number;
  lost: number;
  net: number;
}

export interface MaterialLeaderboardRow {
  rank: number;
  username: string;
  displayName: string;
  eligibleGames: number;
  analyzedGames: number;
  score: number | null;
  pieces: MaterialPieceLedger[];
}

export interface MaterialLeaderboardPage {
  rows: MaterialLeaderboardRow[];
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

export function buildMaterialLeaderboard({
  data,
  preset,
  insight,
  query,
  sortKey,
  direction,
  page,
  pageSize,
}: {
  data: MaterialInsightsData;
  preset: PieceValuePreset;
  insight: MaterialInsight;
  query: string;
  sortKey: MaterialSortKey;
  direction: SortDirection;
  page: number;
  pageSize: number;
}): MaterialLeaderboardPage {
  const rows = data.players.map((player) => {
    const pieces = data.pieceOrder.map((type, index) => {
      const [won, lost] = player.pieces[index];
      return { type, won, lost, net: won - lost };
    });
    const netMaterial = pieces.reduce(
      (total, piece, index) => total + piece.net * data.pieceValues[preset][index],
      0,
    );
    const score = insight === "net-material-per-game"
      ? (player.analyzedGames > 0 ? netMaterial / player.analyzedGames : null)
      : netMaterial;
    return {
      username: player.username,
      displayName: player.displayName,
      eligibleGames: player.eligibleGames,
      analyzedGames: player.analyzedGames,
      score,
      pieces,
    };
  });

  const sortPieceIndex = sortKey === "net" || sortKey === "games"
    ? -1
    : data.pieceOrder.indexOf(sortKey);
  const sortValue = (row: (typeof rows)[number]): number | null => {
    if (sortKey === "net") return row.score;
    if (sortKey === "games") return row.analyzedGames;
    if (insight === "net-material-per-game" && row.analyzedGames === 0) return null;
    const piece = row.pieces[sortPieceIndex];
    if (!piece) return null;
    return insight === "net-material-per-game"
      ? piece.net / row.analyzedGames
      : piece.net;
  };

  rows.sort((left, right) => {
    const leftValue = sortValue(left);
    const rightValue = sortValue(right);
    if (leftValue === null) return rightValue === null ? left.username.localeCompare(right.username) : 1;
    if (rightValue === null) return -1;
    const scoreOrder = direction === "desc"
      ? rightValue - leftValue
      : leftValue - rightValue;
    return scoreOrder || left.username.localeCompare(right.username);
  });

  const rankedRows = rows.map((row, index) => ({ ...row, rank: index + 1 }));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredRows = normalizedQuery
    ? rankedRows.filter((row) => (
      row.username.toLocaleLowerCase().includes(normalizedQuery)
      || row.displayName.toLocaleLowerCase().includes(normalizedQuery)
    ))
    : rankedRows;
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
