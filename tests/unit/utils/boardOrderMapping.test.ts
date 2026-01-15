import { describe, expect, it } from "vitest";
import {
  getBoardOrder,
  getDisplayBoardLabel,
  getMoveListColumnIndex,
  getPlayersForBoard,
} from "../../../app/utils/boardOrderMapping";

describe("boardOrderMapping", () => {
  it("returns the correct left/right order", () => {
    expect(getBoardOrder(false)).toEqual({ leftBoardId: "A", rightBoardId: "B" });
    expect(getBoardOrder(true)).toEqual({ leftBoardId: "B", rightBoardId: "A" });
  });

  it("swaps board labels for display", () => {
    expect(getDisplayBoardLabel("A", false)).toBe("A");
    expect(getDisplayBoardLabel("B", false)).toBe("B");
    expect(getDisplayBoardLabel("A", true)).toBe("B");
    expect(getDisplayBoardLabel("B", true)).toBe("A");
  });

  it("maps move list columns based on swap state", () => {
    expect(
      getMoveListColumnIndex({ boardId: "A", side: "white", isBoardOrderSwapped: false }),
    ).toBe(0);
    expect(
      getMoveListColumnIndex({ boardId: "A", side: "black", isBoardOrderSwapped: false }),
    ).toBe(1);
    expect(
      getMoveListColumnIndex({ boardId: "B", side: "white", isBoardOrderSwapped: false }),
    ).toBe(2);
    expect(
      getMoveListColumnIndex({ boardId: "B", side: "black", isBoardOrderSwapped: false }),
    ).toBe(3);

    expect(
      getMoveListColumnIndex({ boardId: "A", side: "white", isBoardOrderSwapped: true }),
    ).toBe(2);
    expect(
      getMoveListColumnIndex({ boardId: "A", side: "black", isBoardOrderSwapped: true }),
    ).toBe(3);
    expect(
      getMoveListColumnIndex({ boardId: "B", side: "white", isBoardOrderSwapped: true }),
    ).toBe(0);
    expect(
      getMoveListColumnIndex({ boardId: "B", side: "black", isBoardOrderSwapped: true }),
    ).toBe(1);
  });

  it("returns board-specific player pairs", () => {
    const players = {
      aWhite: { username: "A-White" },
      aBlack: { username: "A-Black" },
      bWhite: { username: "B-White" },
      bBlack: { username: "B-Black" },
    };

    expect(getPlayersForBoard(players, "A")).toEqual({
      white: players.aWhite,
      black: players.aBlack,
    });
    expect(getPlayersForBoard(players, "B")).toEqual({
      white: players.bWhite,
      black: players.bBlack,
    });
  });
});
