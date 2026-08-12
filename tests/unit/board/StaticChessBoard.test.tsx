import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StaticChessBoard from "@/app/components/board/StaticChessBoard";

describe("StaticChessBoard", () => {
  it("uses analysis-board pieces without exposing move controls", () => {
    render(
      <StaticChessBoard
        fen="k7/8/8/8/8/8/8/7K w - -"
        orientation="white"
        label="Final position"
      />,
    );

    const board = screen.getByRole("img", { name: "Final position" });
    expect(board.querySelector('[data-square="a8"] [data-piece="bK"]')).not.toBeNull();
    expect(board.querySelector('[data-square="h1"] [data-piece="wK"]')).not.toBeNull();
    expect(board.querySelector("button")).toBeNull();
  });

  it("orients the first rendered square from Black's perspective", () => {
    render(
      <StaticChessBoard
        fen="k7/8/8/8/8/8/8/7K b - -"
        orientation="black"
        label="Black-facing final position"
      />,
    );

    const board = screen.getByRole("img", { name: "Black-facing final position" });
    expect(board.firstElementChild).toHaveAttribute("data-square", "h1");
    expect(board.firstElementChild?.querySelector('[data-piece="wK"]')).not.toBeNull();
  });
});
