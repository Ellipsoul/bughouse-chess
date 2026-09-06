// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { loadPreview } from "@/app/utils/social-preview/loadPreview.server";
import { getAdminFirestore } from "@/app/utils/platform/firebaseAdmin";
import original from "../../../fixtures/chesscom/160842423885.json";
import partner from "../../../fixtures/chesscom/160842423883.json";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
vi.mock("@/app/utils/platform/firebaseAdmin", () => ({ getAdminFirestore: vi.fn() }));
beforeEach(() => vi.restoreAllMocks());

it("reads only the first indexed game of a saved match", async () => {
  const limit = vi.fn(() => ({ get: async () => ({ docs: [{ data: () => ({ type: "match", index: 0, data: { original, partner } }) }] }) }));
  const orderBy = vi.fn(() => ({ limit }));
  const collection = vi.fn(() => ({ orderBy }));
  const doc = vi.fn(() => ({ get: async () => ({ exists: true, data: () => ({ type: "match" }) }), collection }));
  vi.mocked(getAdminFirestore).mockReturnValue({ collection: () => ({ doc }) } as unknown as ReturnType<typeof getAdminFirestore>);
  expect(await loadPreview("sharedId", "example")).toEqual({ original, partner, match: true });
  expect(doc).toHaveBeenCalledWith("example");
  expect(collection).toHaveBeenCalledWith("games");
  expect(orderBy).toHaveBeenCalledWith("index");
  expect(limit).toHaveBeenCalledWith(1);
});

it("fetches the exact partner named by Chess.com", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json(original)).mockResolvedValueOnce(Response.json(partner));
  expect(await loadPreview("gameId", String(original.game.id))).toEqual({ original, partner, match: false });
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    `https://www.chess.com/callback/live/game/${original.game.id}`,
    `https://www.chess.com/callback/live/game/${original.game.partnerGameId}`,
  ]);
});
