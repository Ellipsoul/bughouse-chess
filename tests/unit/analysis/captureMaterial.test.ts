import { describe, expect, it } from "vitest";
import {
  applyCaptureToLedger,
  createEmptyCaptureMaterialLedger,
  formatSignedCaptureMaterial,
  getBughouseCaptureValueForPiece,
} from "../../../app/utils/analysis/captureMaterial";

describe("captureMaterial", () => {
  it("maps pieces to bughouse capture values", () => {
    expect(getBughouseCaptureValueForPiece("p")).toBe(1);
    expect(getBughouseCaptureValueForPiece("n")).toBe(2);
    expect(getBughouseCaptureValueForPiece("b")).toBe(2);
    expect(getBughouseCaptureValueForPiece("r")).toBe(2);
    expect(getBughouseCaptureValueForPiece("q")).toBe(4);
  });

  it("applies symmetric deltas for a capture (capturer +, opponent -)", () => {
    const start = createEmptyCaptureMaterialLedger();
    const next = applyCaptureToLedger({
      ledger: start,
      board: "A",
      capturerSide: "white",
      capturedPiece: "n",
    });

    expect(next.A.white).toBe(2);
    expect(next.A.black).toBe(-2);
    expect(next.B.white).toBe(0);
    expect(next.B.black).toBe(0);
  });

  it("formats signed values for UI", () => {
    expect(formatSignedCaptureMaterial(0)).toBe("0");
    expect(formatSignedCaptureMaterial(2)).toBe("+2");
    expect(formatSignedCaptureMaterial(-3)).toBe("-3");
  });
});
