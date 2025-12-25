import { describe, it, expect } from "vitest";
import {
  buildArrowKey,
  isSquare,
  toggleArrowInList,
  toggleSquareInList,
} from "../../../app/utils/boardAnnotations";

describe("boardAnnotations", () => {
  describe("isSquare", () => {
    it("accepts valid squares", () => {
      expect(isSquare("a1")).toBe(true);
      expect(isSquare("e4")).toBe(true);
      expect(isSquare("h8")).toBe(true);
    });

    it("rejects invalid squares", () => {
      expect(isSquare("i1")).toBe(false);
      expect(isSquare("a0")).toBe(false);
      expect(isSquare("a9")).toBe(false);
      expect(isSquare("")).toBe(false);
      expect(isSquare("e10")).toBe(false);
      expect(isSquare("E4")).toBe(false);
    });
  });

  describe("toggleSquareInList", () => {
    it("adds a square when missing", () => {
      expect(toggleSquareInList([], "e4")).toEqual(["e4"]);
    });

    it("removes a square when present", () => {
      expect(toggleSquareInList(["e4", "a1"], "e4")).toEqual(["a1"]);
    });

    it("preserves ordering of remaining elements when removing", () => {
      expect(toggleSquareInList(["a1", "e4", "h8"], "e4")).toEqual(["a1", "h8"]);
    });
  });

  describe("toggleArrowInList", () => {
    it("adds/removes the same directed arrow on repeat", () => {
      const added = toggleArrowInList([], "e2", "e4");
      expect(added).toEqual([buildArrowKey("e2", "e4")]);

      const removed = toggleArrowInList(added, "e2", "e4");
      expect(removed).toEqual([]);
    });

    it("treats reverse direction as a different arrow", () => {
      const a = toggleArrowInList([], "e2", "e4");
      const b = toggleArrowInList(a, "e4", "e2");
      expect(b).toEqual([buildArrowKey("e2", "e4"), buildArrowKey("e4", "e2")]);
    });
  });
});
