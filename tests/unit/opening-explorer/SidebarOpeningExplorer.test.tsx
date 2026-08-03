import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/app/auth/useAuth", () => ({ useAuth: () => ({ status: "signed_out", user: null }) }));
vi.mock("@/app/components/modals/SettingsModal", () => ({ default: () => null }));
vi.mock("@/app/components/ui/TooltipAnchor", () => ({
  TooltipAnchor: ({ children }: { children: React.ReactNode }) => children,
}));

describe("opening explorer sidebar boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("shows the accessible route link only when the local flag is enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_OPENING_EXPLORER", "true");
    const Sidebar = (await import("@/app/components/layout/Sidebar")).default;
    const { unmount } = render(<Sidebar />);

    expect(screen.getByRole("link", { name: "Opening explorer" })).toHaveAttribute("href", "/opening-explorer");
    unmount();

    vi.stubEnv("NEXT_PUBLIC_ENABLE_OPENING_EXPLORER", "false");
    vi.resetModules();
    const DisabledSidebar = (await import("@/app/components/layout/Sidebar")).default;
    render(<DisabledSidebar />);

    expect(screen.queryByRole("link", { name: "Opening explorer" })).not.toBeInTheDocument();
  });
});
