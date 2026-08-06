import type { SortDirection } from "@/app/components/player-insights/leaderboard";

export type KingHeightColor = "white" | "black" | "both";
export type KingHeightSortKey = "average" | "touchdowns";

export interface KingHeightInsightsData {
  schemaVersion: 1;
  dataset: {
    version: string;
    sourceSnapshotSha256: string;
    adapterPolicy: string;
    kingHeightAnalyzerVersion: string;
    cohortPolicy: string;
    acceptedGames: number;
    analyzedGames: number;
    replayExcludedGames: number;
    trackedPlayers: number;
  };
  heightOrder: number[];
  players: Array<{
    username: string;
    displayName: string;
    analyzedGames: number;
    heights: number[];
    heightEightGames: Array<{
      url: string;
      endTime: number | null;
      color: KingHeightColor;
    }>;
  }>;
}

export interface KingHeightLeaderboardRow {
  rank: number;
  username: string;
  displayName: string;
  analyzedGames: number;
  averageHeight: number | null;
  heights: number[];
  probabilities: number[];
  heightEightGames: KingHeightInsightsData["players"][number]["heightEightGames"];
}

export interface KingHeightLeaderboardPage {
  rows: KingHeightLeaderboardRow[];
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

export function buildKingHeightLeaderboard({
  data,
  query,
  direction,
  minimumGames = 0,
  page,
  pageSize,
  sortKey = "average",
}: {
  data: KingHeightInsightsData;
  query: string;
  direction: SortDirection;
  minimumGames?: number;
  page: number;
  pageSize: number;
  sortKey?: KingHeightSortKey;
}): KingHeightLeaderboardPage {
  const rows = data.players.map((player) => {
    const weightedHeight = player.heights.reduce(
      (total, games, index) => total + games * data.heightOrder[index],
      0,
    );
    const averageHeight = player.analyzedGames > 0
      ? weightedHeight / player.analyzedGames
      : null;
    const probabilities = player.heights.map((games) => (
      player.analyzedGames > 0 ? games / player.analyzedGames : 0
    ));
    return { ...player, averageHeight, probabilities };
  });

  rows.sort((left, right) => {
    if (sortKey === "touchdowns") {
      const touchdownOrder = direction === "desc"
        ? right.heightEightGames.length - left.heightEightGames.length
        : left.heightEightGames.length - right.heightEightGames.length;
      return touchdownOrder || left.username.localeCompare(right.username);
    }
    if (left.averageHeight === null) {
      return right.averageHeight === null
        ? left.username.localeCompare(right.username)
        : 1;
    }
    if (right.averageHeight === null) return -1;
    const averageOrder = direction === "desc"
      ? right.averageHeight - left.averageHeight
      : left.averageHeight - right.averageHeight;
    return averageOrder || left.username.localeCompare(right.username);
  });

  const rankedRows = rows
    .filter((row) => row.analyzedGames >= minimumGames)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredRows = rankedRows.filter((row) => (
    normalizedQuery.length === 0
    || row.username.toLocaleLowerCase().includes(normalizedQuery)
    || row.displayName.toLocaleLowerCase().includes(normalizedQuery)
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
