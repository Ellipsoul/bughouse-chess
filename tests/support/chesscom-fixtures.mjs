/** Loaded only by the E2E runner's Next.js process, never by the deployed app. */
import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";

if (process.env.FIREBASE_PROJECT_ID !== "demo-bughouse" || !process.env.CHESSCOM_REQUEST_LOG) {
  throw new Error("Chess.com fixture preload requires the local E2E demo environment");
}
const fixtures = new URL("../fixtures/chesscom/", import.meta.url);
const readGame = (id) => JSON.parse(readFileSync(new URL(`${id}.json`, fixtures), "utf8"));
const match = JSON.parse(readFileSync(new URL("match-index.json", fixtures), "utf8"));
const archive = match.games.flatMap(({ gameId, partnerGameId }) => [gameId, partnerGameId]).map(id => {
  const { game } = readGame(id);
  const headers = game.pgnHeaders;
  return {
    url: `https://www.chess.com/game/live/${id}`, end_time: game.endTime,
    rules: "bughouse", time_control: headers.TimeControl, rated: game.isRated,
    white: { username: headers.White, rating: headers.WhiteElo, result: "win" },
    black: { username: headers.Black, rating: headers.BlackElo, result: "checkmated" },
  };
});
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (!["www.chess.com", "api.chess.com"].includes(url.hostname)) return originalFetch(input, init);
  appendFileSync(process.env.CHESSCOM_REQUEST_LOG, `${JSON.stringify({ request: { url: url.href } })}\n`);
  const gameMatch = url.pathname.match(/^\/callback\/live\/game\/([a-zA-Z0-9-]+)$/);
  if (gameMatch) {
    try { return globalThis.Response.json(readGame(gameMatch[1])); }
    catch { return globalThis.Response.json({ error: "Fixture not found" }, { status: 404 }); }
  }
  const month = url.pathname.match(/^\/pub\/player\/([^/]+)\/games\/(\d{4})\/(\d{2})$/);
  if (month) {
    const player = decodeURIComponent(month[1]).toLowerCase();
    return globalThis.Response.json({ games: archive.filter(game => {
      const date = new Date(game.end_time * 1000);
      return date.getUTCFullYear() === Number(month[2]) && date.getUTCMonth() + 1 === Number(month[3])
        && [game.white.username, game.black.username].some(name => name.toLowerCase() === player);
    }) });
  }
  throw new Error(`Unmocked Chess.com E2E request: ${url.href} (${fileURLToPath(fixtures)})`);
};
