/**
 * Unit tests for opening-explorer board replay ({@link replayOpeningPrefix}).
 *
 * Ensures TCN move-token prefixes replay to the correct FEN, human-readable
 * labels, and last-move highlight metadata — including first-class Bughouse drops
 * (`&` tokens) that standard chess parsers omit.
 */
import { describe, expect, it } from "vitest";
import { replayOpeningPrefix } from "@/app/components/opening-explorer/boardState";

describe("opening explorer one-board replay", () => {
  it("replays exact TCN prefixes including first-class Bughouse drops", () => {
    const position = replayOpeningPrefix(["mC", "0K", "&m"]);

    expect(position.fen).toBe(
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPPQPPP/RNBQKBNR b KQkq -",
    );
    expect(position.moves.map((move) => move.label)).toEqual(["e4", "e5", "Q@e2"]);
    expect(position.lastMove).toEqual({ from: null, to: "e2" });
  });
});
