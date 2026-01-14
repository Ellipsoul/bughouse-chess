import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChessTitleBadge } from "../../../app/components/badges/ChessTitleBadge";

describe("ChessTitleBadge", () => {
  it("renders nothing when chessTitle is missing/empty", () => {
    const { container: c1 } = render(<ChessTitleBadge chessTitle={undefined} />);
    expect(c1).toBeEmptyDOMElement();

    const { container: c2 } = render(<ChessTitleBadge chessTitle={"   "} />);
    expect(c2).toBeEmptyDOMElement();
  });

  it("renders a GM badge with black background and white text", () => {
    render(<ChessTitleBadge chessTitle="GM" />);
    const badge = screen.getByLabelText("Chess title: GM");
    expect(badge).toHaveTextContent("GM");
    expect(badge.className).toContain("bg-black");
    expect(badge.className).toContain("text-white");
  });

  it("normalizes casing/whitespace", () => {
    render(<ChessTitleBadge chessTitle="  wfm " />);
    const badge = screen.getByLabelText("Chess title: WFM");
    expect(badge).toHaveTextContent("WFM");
    expect(badge.className).toContain("bg-orange");
    expect(badge.className).toContain("text-black");
  });
});
