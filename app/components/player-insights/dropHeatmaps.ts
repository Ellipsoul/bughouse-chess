export type DropPieceType = "pawn" | "knight" | "bishop" | "rook" | "queen";
export type DropColorMode = "combined" | "white" | "black";

export interface DropHeatmapInsightsData {
  schemaVersion: 1;
  dataset: {
    version: string;
    sourceSnapshotSha256: string;
    adapterPolicy: string;
    dropHeatmapAnalyzerVersion: string;
    cohortPolicy: string;
    acceptedGames: number;
    analyzedGames: number;
    replayExcludedGames: number;
    trackedPlayers: number;
  };
  pieceOrder: DropPieceType[];
  squareOrder: string[];
  players: Array<{
    username: string;
    displayName: string;
    analyzedGames: number;
    analyzedGamesByColor: [number, number];
    dropsByColor: [number[][], number[][]];
  }>;
}

export interface DropHeatmapLeaderboardRow {
  username: string;
  displayName: string;
  analyzedGames: number;
  representedGames: number;
  drops: number[][];
  pieceTotals: number[];
  probabilities: number[][];
}

function reflectedRankIndex(squareIndex: number): number {
  return (7 - Math.floor(squareIndex / 8)) * 8 + (squareIndex % 8);
}

export function deriveDropHeatmapRow(
  player: DropHeatmapInsightsData["players"][number],
  colorMode: DropColorMode,
): DropHeatmapLeaderboardRow {
  const drops = colorMode === "white"
    ? player.dropsByColor[0]
    : colorMode === "black"
      ? player.dropsByColor[1]
      : player.dropsByColor[0].map((whiteSquares, pieceIndex) => (
        whiteSquares.map((whiteDrops, squareIndex) => (
          whiteDrops
          + player.dropsByColor[1][pieceIndex][reflectedRankIndex(squareIndex)]
        ))
      ));
  const representedGames = colorMode === "combined"
    ? player.analyzedGames
    : player.analyzedGamesByColor[colorMode === "white" ? 0 : 1];
  const pieceTotals = drops.map((squares) => (
    squares.reduce((total, count) => total + count, 0)
  ));
  const probabilities = drops.map((squares, pieceIndex) => (
    squares.map((count) => (
      pieceTotals[pieceIndex] === 0 ? 0 : count / pieceTotals[pieceIndex]
    ))
  ));

  return {
    username: player.username,
    displayName: player.displayName,
    analyzedGames: player.analyzedGames,
    representedGames,
    drops,
    pieceTotals,
    probabilities,
  };
}

export interface DropHeatmapLeaderboardPage {
  rows: DropHeatmapLeaderboardRow[];
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

export function buildDropHeatmapLeaderboard({
  data,
  query,
  colorMode,
  page,
  pageSize,
}: {
  data: DropHeatmapInsightsData;
  query: string;
  colorMode: DropColorMode;
  page: number;
  pageSize: number;
}): DropHeatmapLeaderboardPage {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const rows = data.players
    .filter((player) => (
      normalizedQuery.length === 0
      || player.username.toLocaleLowerCase().includes(normalizedQuery)
      || player.displayName.toLocaleLowerCase().includes(normalizedQuery)
    ))
    .map((player) => deriveDropHeatmapRow(player, colorMode))
    .sort((left, right) => (
      right.representedGames - left.representedGames
      || left.username.localeCompare(right.username)
    ));
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pageStart = (currentPage - 1) * pageSize;

  return {
    rows: rows.slice(pageStart, pageStart + pageSize),
    page: currentPage,
    pageSize,
    totalRows: rows.length,
    totalPages,
  };
}
