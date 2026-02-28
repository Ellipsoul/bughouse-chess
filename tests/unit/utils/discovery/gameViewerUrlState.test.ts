import { describe, expect, it } from "vitest";
import {
  buildGameViewerUrl,
  clampPlyToMainlineBounds,
  parsePlyFromSearchParams,
  shouldSyncGameViewerUrl,
} from "@/app/utils/discovery/gameViewerUrlState";

describe("parsePlyFromSearchParams", () => {
  it("returns null when ply is missing", () => {
    expect(parsePlyFromSearchParams(new URLSearchParams(""))).toBeNull();
  });

  it("parses valid non-negative integer ply", () => {
    expect(parsePlyFromSearchParams(new URLSearchParams("ply=0"))).toBe(0);
    expect(parsePlyFromSearchParams(new URLSearchParams("ply=12"))).toBe(12);
  });

  it("returns null for invalid values", () => {
    expect(parsePlyFromSearchParams(new URLSearchParams("ply=-1"))).toBeNull();
    expect(parsePlyFromSearchParams(new URLSearchParams("ply=abc"))).toBeNull();
    expect(parsePlyFromSearchParams(new URLSearchParams("ply=1.5"))).toBeNull();
    expect(parsePlyFromSearchParams(new URLSearchParams("ply= "))).toBeNull();
  });
});

describe("clampPlyToMainlineBounds", () => {
  it("clamps within [0, maxPly]", () => {
    expect(clampPlyToMainlineBounds(0, 10)).toBe(0);
    expect(clampPlyToMainlineBounds(5, 10)).toBe(5);
    expect(clampPlyToMainlineBounds(99, 10)).toBe(10);
  });
});

describe("shouldSyncGameViewerUrl", () => {
  it("always syncs for brand-new game loads", () => {
    expect(shouldSyncGameViewerUrl({ action: "newGameLoad", sharedId: null })).toBe(true);
    expect(shouldSyncGameViewerUrl({ action: "newGameLoad", sharedId: "abc" })).toBe(true);
  });

  it("syncs match navigation only when not in shared mode", () => {
    expect(shouldSyncGameViewerUrl({ action: "matchNavigation", sharedId: null })).toBe(true);
    expect(shouldSyncGameViewerUrl({ action: "matchNavigation", sharedId: "abc" })).toBe(false);
  });
});

describe("buildGameViewerUrl", () => {
  it("builds canonical game URL and removes legacy gameid", () => {
    const nextUrl = buildGameViewerUrl({
      pathname: "/",
      currentSearchParams: new URLSearchParams("gameid=111&foo=bar"),
      gameId: "222",
    });
    expect(nextUrl).toBe("/?foo=bar&gameId=222");
  });

  it("adds ply when provided", () => {
    const nextUrl = buildGameViewerUrl({
      pathname: "/",
      currentSearchParams: new URLSearchParams("gameId=111"),
      gameId: "222",
      ply: 7,
    });
    expect(nextUrl).toBe("/?gameId=222&ply=7");
  });

  it("clears stale ply and sharedId when requested", () => {
    const nextUrl = buildGameViewerUrl({
      pathname: "/",
      currentSearchParams: new URLSearchParams("sharedId=abc&ply=5&foo=bar"),
      gameId: "333",
      clearSharedId: true,
    });
    expect(nextUrl).toBe("/?foo=bar&gameId=333");
  });
});
