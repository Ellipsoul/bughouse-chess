import { describe, it, expect } from "vitest";
import { computeReservePiecePx } from "../../../app/components/PieceReserveVertical";

describe("PieceReserveVertical sizing", () => {
  describe("computeReservePiecePx", () => {
    it("shrinks pieces in compact mode on short viewports", () => {
      const px = computeReservePiecePx({ height: 260, density: "compact" });
      expect(px).toBeLessThanOrEqual(30);
      expect(px).toBeGreaterThanOrEqual(18);
    });

    it("allows larger pieces in default mode when height allows it", () => {
      const px = computeReservePiecePx({ height: 400, density: "default" });
      expect(px).toBeLessThanOrEqual(40);
      expect(px).toBeGreaterThanOrEqual(18);
    });

    it("clamps to a minimum size for extremely small heights", () => {
      const px = computeReservePiecePx({ height: 120, density: "compact" });
      expect(px).toBe(18);
    });
  });
});


