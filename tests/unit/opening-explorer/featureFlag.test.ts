import { describe, expect, it } from "vitest";
import { openingExplorerEnabled } from "@/app/components/opening-explorer/featureFlag";

describe("opening explorer exposure gate", () => {
  it("allows local development and only explicitly configured hosted environments", () => {
    expect(openingExplorerEnabled({
      nodeEnv: "development",
      localFlag: "true",
      requestHost: "localhost:3000",
    })).toBe(true);

    const preview = {
      nodeEnv: "production",
      vercelEnvironment: "preview",
      previewFlag: "true",
      previewHosts: "bughouse-chess-git-opening-explorer-aronteh-projects.vercel.app",
    };
    expect(openingExplorerEnabled({
      ...preview,
      requestHost: "bughouse-chess-git-opening-explorer-aronteh-projects.vercel.app",
    })).toBe(true);
    expect(openingExplorerEnabled({
      ...preview,
      requestHost: "bughouse.aronteh.com",
    })).toBe(false);
    expect(openingExplorerEnabled({
      ...preview,
      vercelEnvironment: "production",
      requestHost: "bughouse-chess-git-opening-explorer-aronteh-projects.vercel.app",
    })).toBe(false);

    const production = {
      nodeEnv: "production",
      productionFlag: "true",
      productionHosts: "bughouse.aronteh.com,bughouse-chess.vercel.app",
      vercelEnvironment: "production",
    };
    expect(openingExplorerEnabled({
      ...production,
      requestHost: "bughouse.aronteh.com",
    })).toBe(true);
    expect(openingExplorerEnabled({
      ...production,
      requestHost: "unlisted.example.test",
    })).toBe(false);
    expect(openingExplorerEnabled({
      ...production,
      productionFlag: undefined,
      requestHost: "bughouse.aronteh.com",
    })).toBe(false);
  });
});
