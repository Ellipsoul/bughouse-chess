import { describe, expect, it } from "vitest";
import { getNonBughouseGameErrorMessage } from "../../../app/utils/chesscomGameValidation";

describe("getNonBughouseGameErrorMessage", () => {
  it("returns null for bughouse games", () => {
    const message = getNonBughouseGameErrorMessage({
      game: { type: "bughouse", typeName: "Bughouse" },
    });
    expect(message).toBeNull();
  });

  it("returns an error message for non-bughouse games", () => {
    const message = getNonBughouseGameErrorMessage({
      game: { type: "chess", typeName: "Chess" },
    });
    expect(message).toBeTypeOf("string");
    expect(message).toContain("not a Bughouse");
    expect(message).toContain("Chess");
  });

  it("handles missing fields defensively", () => {
    const message = getNonBughouseGameErrorMessage(null);
    expect(message).toBeTypeOf("string");
    expect(message).toContain("not a Bughouse");
  });
});


