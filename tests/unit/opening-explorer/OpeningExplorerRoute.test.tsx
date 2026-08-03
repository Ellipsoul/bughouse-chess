import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("not-found"); }));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/app/components/opening-explorer/OpeningExplorerPageClient", () => ({
  default: () => <div>explorer</div>,
}));

describe("opening explorer route gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    notFound.mockClear();
  });

  it("makes the route unavailable when the shared local flag is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_OPENING_EXPLORER", "false");
    const Page = (await import("@/app/opening-explorer/page")).default;

    expect(() => Page()).toThrow("not-found");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("renders its own page when the local flag is enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_OPENING_EXPLORER", "true");
    const Page = (await import("@/app/opening-explorer/page")).default;

    expect(Page()).toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });
});
