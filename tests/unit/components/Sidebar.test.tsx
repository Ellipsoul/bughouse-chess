import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/auth/useAuth", () => ({
  useAuth: () => ({ status: "signed_out", user: null }),
}));

vi.mock("@/app/components/ui/TooltipAnchor", () => ({
  TooltipAnchor: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/app/components/modals/SettingsModal", () => ({
  default: () => null,
}));

import Sidebar from "@/app/components/layout/Sidebar";

describe("Sidebar", () => {
  it("offers player insights as its own primary destination", () => {
    render(<Sidebar />);

    expect(screen.getByRole("link", { name: "Player Insights" })).toHaveAttribute(
      "href",
      "/player-insights",
    );
  });
});
