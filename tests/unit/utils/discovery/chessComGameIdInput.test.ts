/**
 * Unit tests for chess.com game id input sanitization (`chessComGameIdInput.ts`).
 *
 * Strips URL fragments and whitespace so pasted chess.com links resolve to raw ids.
 */
import { describe, expect, it } from "vitest";
import {
  resolveChessComGameIdFromQueryParam,
  sanitizeChessComGameIdInput,
} from "@/app/utils/discovery/chessComGameIdInput";

describe("sanitizeChessComGameIdInput", () => {
  it("returns raw IDs unchanged", () => {
    expect(sanitizeChessComGameIdInput("162593823435")).toBe("162593823435");
  });

  it("extracts IDs from bughouse share URLs", () => {
    expect(sanitizeChessComGameIdInput("https://bughouse.aronteh.com/?gameId=162593823435")).toBe(
      "162593823435",
    );
    expect(sanitizeChessComGameIdInput("https://bughouse.aronteh.com/?gameid=162593823435")).toBe(
      "162593823435",
    );
  });

  it("extracts IDs from chess.com game URLs", () => {
    expect(sanitizeChessComGameIdInput("https://www.chess.com/game/live/160407448121")).toBe(
      "160407448121",
    );
    expect(
      sanitizeChessComGameIdInput("https://www.chess.com/game/live/160407448121/?foo=bar"),
    ).toBe("160407448121");
  });

  it("extracts IDs when a share URL nests a chess.com game URL in gameId", () => {
    // Users sometimes paste a Chess.com link into our share URL's gameId param.
    // Sanitization must fully resolve to the numeric id (not stop at the nested URL).
    expect(
      sanitizeChessComGameIdInput(
        "https://bughouse.aronteh.com/?gameId=https://www.chess.com/game/live/180191871227",
      ),
    ).toBe("180191871227");
  });
});

describe("resolveChessComGameIdFromQueryParam", () => {
  it("returns null for missing or blank values", () => {
    expect(resolveChessComGameIdFromQueryParam(null)).toBeNull();
    expect(resolveChessComGameIdFromQueryParam(undefined)).toBeNull();
    expect(resolveChessComGameIdFromQueryParam("")).toBeNull();
    expect(resolveChessComGameIdFromQueryParam("   ")).toBeNull();
  });

  it("returns raw numeric ids unchanged", () => {
    expect(resolveChessComGameIdFromQueryParam("180191871227")).toBe("180191871227");
  });

  it("canonicalizes a Chess.com game URL used as the query param value", () => {
    // This is the production bug case: `/?gameId=https://www.chess.com/game/live/...`
    // Auto-load must key off the numeric id, or URL sync / effect dedupe diverge and loop.
    expect(
      resolveChessComGameIdFromQueryParam("https://www.chess.com/game/live/180191871227"),
    ).toBe("180191871227");
  });
});
