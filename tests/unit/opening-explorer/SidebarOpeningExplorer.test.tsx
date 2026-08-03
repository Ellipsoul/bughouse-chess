import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpeningExplorerSidebarGate } from "@/app/components/opening-explorer/OpeningExplorerSidebarGate";

const mocks = vi.hoisted(() => ({ host: "localhost" }));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ host: mocks.host })),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));
vi.mock("@/app/components/ui/TooltipAnchor", () => ({
  TooltipAnchor: ({ children }: { children: React.ReactNode }) => children,
}));

describe("opening explorer sidebar boundary", () => {
  afterEach(() => {
    mocks.host = "localhost";
    vi.unstubAllEnvs();
  });

  it("shows the accessible route link only when the local request is enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_OPENING_EXPLORER", "true");
    const enabled = render(await OpeningExplorerSidebarGate());

    expect(screen.getByRole("link", { name: "Opening explorer" })).toHaveAttribute("href", "/opening-explorer");
    enabled.unmount();

    vi.stubEnv("NEXT_PUBLIC_ENABLE_OPENING_EXPLORER", "false");
    render(await OpeningExplorerSidebarGate());

    expect(screen.queryByRole("link", { name: "Opening explorer" })).not.toBeInTheDocument();
  });

  it("uses the request host and Vercel environment for Preview visibility", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPENING_EXPLORER_PREVIEW_ENABLED", "true");
    vi.stubEnv("OPENING_EXPLORER_PREVIEW_HOSTS", "preview.example.test");
    vi.stubEnv("VERCEL_ENV", "preview");
    mocks.host = "other.example.test";

    const disabled = render(await OpeningExplorerSidebarGate());
    expect(screen.queryByRole("link", { name: "Opening explorer" })).not.toBeInTheDocument();
    disabled.unmount();

    mocks.host = "preview.example.test";
    render(await OpeningExplorerSidebarGate());
    expect(screen.getByRole("link", { name: "Opening explorer" })).toBeInTheDocument();
  });

  it("shows the Production link only on the exact allowlisted host", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPENING_EXPLORER_PRODUCTION_ENABLED", "true");
    vi.stubEnv("OPENING_EXPLORER_PRODUCTION_HOSTS", "bughouse.example.test");
    vi.stubEnv("VERCEL_ENV", "production");
    mocks.host = "bughouse.example.test";

    render(await OpeningExplorerSidebarGate());

    expect(screen.getByRole("link", { name: "Opening explorer" })).toBeInTheDocument();
  });
});
