import { describe, it, expect } from "vitest";
import {
  createEmptyBoardAnnotationsByFen,
  getAnnotationsForFen,
  setAnnotationsForFen,
  toFenKey,
} from "../../../app/utils/boardAnnotationPersistence";
import { EMPTY_BOARD_ANNOTATIONS, type BoardAnnotations } from "../../../app/utils/boardAnnotations";

describe("boardAnnotationPersistence", () => {
  describe("toFenKey", () => {
    it("uses start sentinel for empty/undefined", () => {
      expect(toFenKey(undefined)).toBe("start");
      expect(toFenKey("")).toBe("start");
      expect(toFenKey("   ")).toBe("start");
    });

    it("preserves non-empty fen strings", () => {
      expect(toFenKey("start")).toBe("start");
      expect(toFenKey("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBe(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      );
    });
  });

  describe("getAnnotationsForFen / setAnnotationsForFen", () => {
    it("returns empty annotations when key missing", () => {
      const store = createEmptyBoardAnnotationsByFen();
      const got = getAnnotationsForFen(store, "A", "someFen");
      expect(got).toBe(EMPTY_BOARD_ANNOTATIONS); // stable singleton
      expect(got).toEqual({ circles: [], arrows: [] });
    });

    it("stores and restores annotations for a specific board+fen", () => {
      const store0 = createEmptyBoardAnnotationsByFen();
      const fenKey = "fenA1";
      const ann: BoardAnnotations = { circles: ["e4"], arrows: ["e2->e4"] };

      const store1 = setAnnotationsForFen(store0, "A", fenKey, ann);
      expect(getAnnotationsForFen(store1, "A", fenKey)).toEqual(ann);
    });

    it("keeps board A and board B isolated even with identical fen keys", () => {
      const store0 = createEmptyBoardAnnotationsByFen();
      const fenKey = "sameFen";

      const aAnn: BoardAnnotations = { circles: ["a1"], arrows: [] };
      const bAnn: BoardAnnotations = { circles: [], arrows: ["h7->h1"] };

      const store1 = setAnnotationsForFen(store0, "A", fenKey, aAnn);
      const store2 = setAnnotationsForFen(store1, "B", fenKey, bAnn);

      expect(getAnnotationsForFen(store2, "A", fenKey)).toEqual(aAnn);
      expect(getAnnotationsForFen(store2, "B", fenKey)).toEqual(bAnn);
    });

    it("does not overwrite other fen keys on the same board", () => {
      const store0 = createEmptyBoardAnnotationsByFen();
      const store1 = setAnnotationsForFen(store0, "A", "fen1", { circles: ["c3"], arrows: [] });
      const store2 = setAnnotationsForFen(store1, "A", "fen2", { circles: [], arrows: ["a2->a4"] });

      expect(getAnnotationsForFen(store2, "A", "fen1")).toEqual({ circles: ["c3"], arrows: [] });
      expect(getAnnotationsForFen(store2, "A", "fen2")).toEqual({ circles: [], arrows: ["a2->a4"] });
    });

    it("supports clearing by setting empty annotations for that fen", () => {
      const store0 = createEmptyBoardAnnotationsByFen();
      const fenKey = "fenToClear";
      const store1 = setAnnotationsForFen(store0, "B", fenKey, { circles: ["b2"], arrows: ["b2->b7"] });
      const store2 = setAnnotationsForFen(store1, "B", fenKey, EMPTY_BOARD_ANNOTATIONS);

      expect(getAnnotationsForFen(store2, "B", fenKey)).toBe(EMPTY_BOARD_ANNOTATIONS);
    });
  });
});
