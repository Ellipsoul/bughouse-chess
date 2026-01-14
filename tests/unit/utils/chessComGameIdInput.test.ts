import { describe, expect, it } from "vitest";
import { sanitizeChessComGameIdInput } from "../../../app/utils/chessComGameIdInput";

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
});
