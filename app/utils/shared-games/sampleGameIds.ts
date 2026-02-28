/**
 * List of available sample game IDs extracted from test fixtures.
 * These are valid bughouse game IDs that can be used as default samples.
 *
 * Game IDs are sourced from: tests/fixtures/chesscom/
 */
export const SAMPLE_GAME_IDS = [
  "159889048117",
  "159889048119",
  "160064848971",
  "160064848973",
  "160067249167",
  "160067249169",
  "160319845633",
  "160319845635",
  "160343849259",
  "160343849261",
] as const;

/**
 * Returns a randomly selected game ID from the available sample game IDs.
 * This ensures users get variety when visiting the site without a specific game ID.
 *
 * @returns A random game ID string from the sample pool
 */
export function getRandomSampleGameId(): string {
  const randomIndex = Math.floor(Math.random() * SAMPLE_GAME_IDS.length);
  return SAMPLE_GAME_IDS[randomIndex] ?? SAMPLE_GAME_IDS[0] ?? "";
}
