/**
 * Unit tests for the `/opening-explorer` App Router page shell.
 *
 * Ensures the route always renders the client explorer component without
 * gating on availability env vars — the page is a thin wrapper that delegates
 * all behavior to {@link OpeningExplorerPageClient}.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/components/opening-explorer/OpeningExplorerPageClient", () => ({
  default: () => <div>explorer</div>,
}));

describe("opening explorer route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("renders without availability configuration", async () => {
    const { default: OpeningExplorerPage } = await import("@/app/opening-explorer/page");

    render(<OpeningExplorerPage />);
    expect(screen.getByText("explorer")).toBeInTheDocument();
  });
});
