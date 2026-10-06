export type DropPieceType = "pawn" | "knight" | "bishop" | "rook" | "queen";
export type DropColorMode = "combined" | "white" | "black";

/**
 * Static drop counts indexed by [color][piece][square]. Color tuple order is
 * White, Black; piece and square axes follow `pieceOrder` and `squareOrder`.
 */
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

/**
 * Display counts and per-piece square probabilities. `representedGames` follows
 * the selected color mode; probabilities divide by piece drops, not games.
 */
export interface DropHeatmapRow {
  username: string;
  displayName: string;
  analyzedGames: number;
  representedGames: number;
  drops: number[][];
  pieceTotals: number[];
  probabilities: number[][];
}

/**
 * Reflect ranks in a 64-square, rank-major array while preserving files (a1 ↔ a8).
 */
function reflectedRankIndex(squareIndex: number): number {
  return (7 - Math.floor(squareIndex / 8)) * 8 + (squareIndex % 8);
}

/**
 * Build a player's display distribution for a color mode.
 *
 * Combined mode reflects only Black's ranks before adding White's counts.
 * Single-color modes preserve source coordinates and reuse the source `drops`
 * array; callers must not mutate it. A piece with no drops has zero probabilities.
 *
 * @param player - Checked projection row with White/Black channels.
 * @param colorMode - Combined own-side view, or exact White/Black source squares.
 * @returns Counts, totals, and probabilities in the projection's piece/square order.
 */
export function deriveDropHeatmapRow(
  player: DropHeatmapInsightsData["players"][number],
  colorMode: DropColorMode,
): DropHeatmapRow {
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

/**
 * Sum tracked-player channels, then apply the same orientation as individual rows.
 *
 * The displayed game count comes from dataset metadata, not the sum of player
 * counts: a game can contribute to more than one tracked player's row.
 * The aggregate uses the dataset analyzed-game count in every color mode.
 */
export function deriveTrackedCohortDropHeatmapRow(
  data: DropHeatmapInsightsData,
  colorMode: DropColorMode,
): DropHeatmapRow {
  const emptyColor = () => data.pieceOrder.map(() => (
    data.squareOrder.map(() => 0)
  ));
  const dropsByColor: [number[][], number[][]] = [emptyColor(), emptyColor()];

  for (const player of data.players) {
    for (let colorIndex = 0; colorIndex < dropsByColor.length; colorIndex += 1) {
      for (let pieceIndex = 0; pieceIndex < data.pieceOrder.length; pieceIndex += 1) {
        for (let squareIndex = 0; squareIndex < data.squareOrder.length; squareIndex += 1) {
          dropsByColor[colorIndex][pieceIndex][squareIndex] += (
            player.dropsByColor[colorIndex][pieceIndex][squareIndex]
          );
        }
      }
    }
  }

  return deriveDropHeatmapRow({
    username: "all-tracked-players",
    displayName: "All tracked players",
    analyzedGames: data.dataset.analyzedGames,
    analyzedGamesByColor: [
      data.dataset.analyzedGames,
      data.dataset.analyzedGames,
    ],
    dropsByColor,
  }, colorMode);
}
