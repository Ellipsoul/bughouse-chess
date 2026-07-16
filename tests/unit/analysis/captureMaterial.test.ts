import { describe, expect, it } from "vitest";
import {
  applyCaptureToLedger,
  createEmptyCaptureMaterialLedger,
  formatSignedCaptureMaterial,
  getBughouseCaptureValueForPiece,
} from "@/app/utils/analysis/captureMaterial";

describe("captureMaterial", () => {
  it("maps pieces to bughouse capture values", () => {
    expect(getBughouseCaptureValueForPiece("p")).toBe(1.5);
    expect(getBughouseCaptureValueForPiece("n")).toBe(3);
    expect(getBughouseCaptureValueForPiece("b")).toBe(3);
    expect(getBughouseCaptureValueForPiece("r")).toBe(4);
    expect(getBughouseCaptureValueForPiece("q")).toBe(7);
  });

  it("maps pieces to standard chess capture values", () => {
    expect(getBughouseCaptureValueForPiece("p", "standard")).toBe(1);
    expect(getBughouseCaptureValueForPiece("n", "standard")).toBe(3);
    expect(getBughouseCaptureValueForPiece("b", "standard")).toBe(3);
    expect(getBughouseCaptureValueForPiece("r", "standard")).toBe(5);
    expect(getBughouseCaptureValueForPiece("q", "standard")).toBe(9);
  });

  it("applies symmetric deltas for a capture (capturer +, opponent -)", () => {
    const start = createEmptyCaptureMaterialLedger();
    const next = applyCaptureToLedger({
      ledger: start,
      board: "A",
      capturerSide: "white",
      capturedPiece: "n",
    });

    expect(next.A.white).toBe(3);
    expect(next.A.black).toBe(-3);
    expect(next.B.white).toBe(0);
    expect(next.B.black).toBe(0);
  });

  it("applies the selected preset to ledger updates", () => {
    const next = applyCaptureToLedger({
      ledger: createEmptyCaptureMaterialLedger(),
      board: "B",
      capturerSide: "black",
      capturedPiece: "q",
      pieceValuePreset: "standard",
    });

    expect(next.B.black).toBe(9);
    expect(next.B.white).toBe(-9);
  });

  it("formats signed values for UI", () => {
    expect(formatSignedCaptureMaterial(0)).toBe("0");
    expect(formatSignedCaptureMaterial(2)).toBe("+2");
    expect(formatSignedCaptureMaterial(-3)).toBe("-3");
  });
});
