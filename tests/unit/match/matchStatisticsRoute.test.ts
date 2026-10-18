// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import type { ChessGame } from "@/app/actions";
import original from "../../fixtures/chesscom/161531824441.json";
import partner from "../../fixtures/chesscom/161531824439.json";
import { getMatchStatistics } from "@/app/utils/match/matchStatistics";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), runTransaction: vi.fn() }));
vi.mock("@/app/utils/platform/firebaseAdmin", () => ({
  getAdminFirestore: () => ({ collection: () => ({ doc: () => ({ collection: () => ({ orderBy: () => "games-query" }) }) }), runTransaction: mocks.runTransaction }),
}));
import { POST } from "@/app/api/shared-games/[id]/statistics/route";
const game = { gameId: "1", partnerGameId: "2", original: original as ChessGame, partner: partner as ChessGame, endTime: 0 };
const call = (id = "shared-id") => POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ id }) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.runTransaction.mockImplementation(fn => fn({ get: mocks.get, update: mocks.update }));
});

it("backfills legacy matches from stored games and persists both presets", async () => {
  mocks.get.mockResolvedValueOnce({ exists: true, data: () => ({ type: "partnerGames", metadata: { gameCount: 1 } }) })
    .mockResolvedValueOnce({ docs: [{ data: () => ({ index: 0, type: "match", data: game }) }] });
  const response = await call();
  expect(response.status).toBe(200);
  const stats = await response.json();
  expect(stats).toEqual(await getMatchStatistics([game]));
  expect(mocks.update).toHaveBeenCalledWith(expect.anything(), { matchStatistics: stats });
});
it("does not rewrite current statistics", async () => {
  const stats = await getMatchStatistics([game]);
  mocks.get.mockResolvedValueOnce({ exists: true, data: () => ({ type: "match", metadata: { gameCount: 1 }, matchStatistics: stats }) })
    .mockResolvedValueOnce({ docs: [{ data: () => ({ index: 0, type: "match", data: game }) }] });
  expect((await call()).status).toBe(200);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("refuses incomplete uploads instead of storing partial totals", async () => {
  mocks.get.mockResolvedValueOnce({ exists: true, data: () => ({ type: "match", metadata: { gameCount: 2 } }) })
    .mockResolvedValueOnce({ docs: [{ data: () => ({ index: 0, type: "match", data: game }) }] });
  expect((await call()).status).toBe(409);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("excludes single games and missing documents", async () => {
  mocks.get.mockResolvedValueOnce({ exists: true, data: () => ({ type: "game" }) });
  expect((await call()).status).toBe(400);
  mocks.get.mockResolvedValueOnce({ exists: false });
  expect((await call()).status).toBe(404);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("validates IDs before accessing Firestore and reports service failure", async () => {
  expect((await call("../invalid")).status).toBe(400);
  expect(mocks.runTransaction).not.toHaveBeenCalled();
  mocks.runTransaction.mockRejectedValueOnce(new Error("offline"));
  expect((await call()).status).toBe(503);
});

it("replaces version 1 unavailable material automatically", async () => {
  const current = await getMatchStatistics([game]);
  const stale = { ...current, version: 1, material: { bughouse: null, standard: null } };
  mocks.get.mockResolvedValueOnce({ exists: true, data: () => ({ type: "match", metadata: { gameCount: 1 }, matchStatistics: stale }) })
    .mockResolvedValueOnce({ docs: [{ data: () => ({ index: 0, type: "match", data: game }) }] });
  const response = await call();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(current);
  expect(mocks.update).toHaveBeenCalledWith(expect.anything(), { matchStatistics: current });
});
