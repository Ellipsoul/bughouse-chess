import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchGame } from "@/app/types/match";
import original from "../../fixtures/chesscom/161531824441.json";
import partner from "../../fixtures/chesscom/161531824439.json";
import type { ChessGame } from "@/app/actions";

const material = vi.hoisted(() => vi.fn());
vi.mock("@/app/utils/match/matchMaterial", () => ({ computeGameMaterial: material }));
const fixture: MatchGame = { gameId: "1", partnerGameId: "2", original: original as ChessGame, partner: partner as ChessGame, endTime: 0 };

beforeEach(() => { vi.resetModules(); localStorage.clear(); material.mockReset().mockReturnValue({ alice: 4, bob: -4 }); });

describe("match statistics cache", () => {
  it("counts actions per board and shares work across mounts and reconstructed objects", async () => {
    const { getMatchStatistics } = await import("@/app/utils/match/matchStatistics");
    const games = [fixture, { ...fixture, gameId: "3" }];
    const first = getMatchStatistics(games);
    expect(getMatchStatistics(structuredClone(games))).toBe(first);
    const stats = await first;
    expect(stats.moves).toEqual({ A: original.game.moveList.length, B: partner.game.moveList.length });
    expect(stats.material.bughouse).toEqual({ alice: 8, bob: -8 });
    expect(material).toHaveBeenCalledTimes(4); // two games, two presets; no UI-dependent replay
    expect(await getMatchStatistics(games)).toBe(stats);
  });

  it("loads durable browser cache after module reload without replay", async () => {
    let statsModule = await import("@/app/utils/match/matchStatistics");
    const expected = await statsModule.getMatchStatistics([fixture]);
    vi.resetModules(); material.mockClear();
    statsModule = await import("@/app/utils/match/matchStatistics");
    expect(await statsModule.getMatchStatistics([fixture])).toEqual(expected);
    expect(material).not.toHaveBeenCalled();
  });

  it("uses persisted Firestore values and rejects stale versions/content", async () => {
    const { getMatchStatistics, seedMatchStatistics, matchStatisticsKey } = await import("@/app/utils/match/matchStatistics");
    const games = [fixture];
    const stored = { version: 2, fingerprint: matchStatisticsKey(games), gameCount: 1,
      moves: { A: 100, B: 90 }, material: { bughouse: { alice: 5 }, standard: { alice: 7 } } };
    expect(seedMatchStatistics(games, { ...stored, version: 1 })).toBe(false);
    expect(seedMatchStatistics(games, stored)).toBe(true);
    expect(await getMatchStatistics(games)).toBe(stored);
    expect(material).not.toHaveBeenCalled();
    const changed = structuredClone(games); changed[0].original.game.moveList += "ab";
    expect(seedMatchStatistics(changed, stored)).toBe(false);
    expect((await getMatchStatistics(changed)).moves.A).toBe(original.game.moveList.length / 2 + 1);
  });

  it("retains move totals but never publishes partial material", async () => {
    const { getMatchStatistics } = await import("@/app/utils/match/matchStatistics");
    material.mockReturnValueOnce(null);
    const stats = await getMatchStatistics([fixture]);
    expect(stats.material.bughouse).toBeNull();
    expect(stats.material.standard).toEqual({ alice: 4, bob: -4 });
    expect(stats.moves.A).toBe(original.game.moveList.length / 2);
  });

  it("rejects malformed action data and allows retry", async () => {
    const { getMatchStatistics } = await import("@/app/utils/match/matchStatistics");
    const broken = structuredClone(fixture); broken.original.game.moveList += "a";
    await expect(getMatchStatistics([broken])).rejects.toThrow("Invalid move data");
    await expect(getMatchStatistics([broken])).rejects.toThrow("Invalid move data");
  });
});

describe("background statistics", () => {
  it("coalesces repair with dropdown consumers and falls back after a server failure", async () => {
    const { prepareMatchStatistics, getMatchStatistics } = await import("@/app/utils/match/matchStatistics");
    let fail!: (error: Error) => void;
    const load = vi.fn(() => new Promise<unknown>((_, reject) => { fail = reject; }));
    prepareMatchStatistics([fixture], load);
    prepareMatchStatistics(structuredClone([fixture]), load);
    const result = getMatchStatistics([fixture]);
    expect(load).not.toHaveBeenCalled();
    expect(material).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(material).not.toHaveBeenCalled();
    fail(new Error("offline"));
    expect((await result).material.bughouse).toEqual({ alice: 4, bob: -4 });
  });

  it("runs browser calculation in a worker and terminates it on completion", async () => {
    const terminate = vi.fn();
    const worker = {
      onmessage: vi.fn<(event: { data: unknown }) => void>(),
      postMessage: vi.fn(),
      terminate,
    };
    vi.stubGlobal("Worker", class {
      constructor() { return worker; }
    });
    try {
      const { getMatchStatistics, matchStatisticsKey } = await import("@/app/utils/match/matchStatistics");
      const result = getMatchStatistics([fixture]);
      expect(worker.postMessage).toHaveBeenCalledWith({ games: [fixture], key: matchStatisticsKey([fixture]) });
      expect(material).not.toHaveBeenCalled();
      const stats = { version: 2, fingerprint: matchStatisticsKey([fixture]), gameCount: 1, moves: { A: 1, B: 2 }, material: { bughouse: { alice: 4 }, standard: { alice: 5 } } };
      worker.onmessage({ data: stats });
      expect(await result).toEqual(stats);
      expect(terminate).toHaveBeenCalledOnce();
    } finally { vi.unstubAllGlobals(); }
  });
});
