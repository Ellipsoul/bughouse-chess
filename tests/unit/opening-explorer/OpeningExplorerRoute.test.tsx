import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("not-found"); }));
const requestHeaders = vi.hoisted(() => ({ host: "localhost:3000" }));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => name === "host" ? requestHeaders.host : null }),
}));
vi.mock("@/app/components/opening-explorer/OpeningExplorerPageClient", () => ({
  default: () => <div>explorer</div>,
}));

describe("opening explorer route gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    notFound.mockClear();
    requestHeaders.host = "localhost:3000";
  });

  it("makes the route unavailable when the shared local flag is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_OPENING_EXPLORER", "false");
    const { OpeningExplorerGate } = await import("@/app/opening-explorer/page");

    await expect(OpeningExplorerGate()).rejects.toThrow("not-found");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("renders in production mode only on the configured Vercel Preview host", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("OPENING_EXPLORER_PREVIEW_ENABLED", "true");
    vi.stubEnv(
      "OPENING_EXPLORER_PREVIEW_HOSTS",
      "bughouse-chess-git-opening-explorer-aronteh-projects.vercel.app",
    );
    requestHeaders.host = "bughouse-chess-git-opening-explorer-aronteh-projects.vercel.app";
    const { OpeningExplorerGate } = await import("@/app/opening-explorer/page");

    expect(await OpeningExplorerGate()).toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("renders in Production only when the server flag and exact host agree", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("OPENING_EXPLORER_PRODUCTION_ENABLED", "true");
    vi.stubEnv("OPENING_EXPLORER_PRODUCTION_HOSTS", "bughouse.aronteh.com");
    requestHeaders.host = "bughouse.aronteh.com";
    const { OpeningExplorerGate } = await import("@/app/opening-explorer/page");

    expect(await OpeningExplorerGate()).toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });
});
