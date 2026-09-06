import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { previewParams, previewPosition } from "@/app/utils/social-preview/position";
import type { ChessGame } from "@/app/actions";
import original from "../../../fixtures/chesscom/160842423885.json";
import partner from "../../../fixtures/chesscom/160842423883.json";

const a = original as unknown as ChessGame;
const b = partner as unknown as ChessGame;

describe("social preview selection", () => {
  it("keeps source precedence and normalizes legacy links", () => {
    expect(previewParams(new URLSearchParams("gameid=123&gameId=456&ply=02&junk=x"))?.toString()).toBe("gameId=123&ply=2");
    expect(previewParams(new URLSearchParams("sharedId=abc&gameId=123"))?.toString()).toBe("sharedId=abc");
  });
  it("rejects invalid sources and ignores malformed moves", () => {
    for (const input of ["", "gameId=https://evil.test", "sharedId=../users"]) expect(previewParams(new URLSearchParams(input))).toBeNull();
    expect(previewParams(new URLSearchParams("gameId=123&ply=-1"))?.toString()).toBe("gameId=123");
  });
  it("treats ply zero as the initial position on both boards", () => {
    const { state } = previewPosition(a, b, 0);
    expect(state.boardA.fen).toBe(new Chess().fen());
    expect(state.boardB.fen).toBe(new Chess().fen());
  });
  it("applies exactly one move across the two-board timeline", () => {
    const { state, appliedPly } = previewPosition(a, b, 1);
    expect(appliedPly).toBe(1);
    expect(state.boardA.moves.length + state.boardB.moves.length).toBe(1);
  });
  it("replays the entire captured fixture including drops and clamps excessive ply", () => {
    const final = previewPosition(a, b, null);
    expect(final.appliedPly).toBe(a.game.plyCount + b.game.plyCount);
    expect(final.state.boardA.moves.length).toBe(a.game.plyCount);
    expect(final.state.boardB.moves.length).toBe(b.game.plyCount);
    expect(previewPosition(a, b, 99999)).toEqual(final);
  });
});
