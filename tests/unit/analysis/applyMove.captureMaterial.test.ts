import { describe, expect, it } from "vitest";
import type { BughousePositionSnapshot } from "../../../app/types/analysis";
import { createEmptyReserves, validateAndApplyBughouseHalfMove } from "../../../app/utils/analysis/applyMove";
import { createEmptyCaptureMaterialLedger } from "../../../app/utils/analysis/captureMaterial";

describe("validateAndApplyBughouseHalfMove - captureMaterial", () => {
  it("tracks a regular capture (pawn = 1.5)", () => {
    const pos: BughousePositionSnapshot = {
      // White pawn d4 can capture black pawn e5
      fenA: "4k3/8/8/4p3/3P4/8/8/4K3 w - - 0 1",
      fenB: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
      reserves: createEmptyReserves(),
      promotedSquares: { A: [], B: [] },
      captureMaterial: createEmptyCaptureMaterialLedger(),
    };

    const result = validateAndApplyBughouseHalfMove(pos, {
      kind: "normal",
      board: "A",
      from: "d4",
      to: "e5",
    });
    if (result.type !== "ok") throw new Error(`Expected ok, got ${result.type}`);

    expect(result.next.captureMaterial.A.white).toBe(1.5);
    expect(result.next.captureMaterial.A.black).toBe(-1.5);
  });

  it("tracks an en-passant capture (pawn = 1.5)", () => {
    const pos: BughousePositionSnapshot = {
      // White pawn e5 can capture en-passant on d6 (capturing pawn on d5).
      fenA: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1",
      fenB: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
      reserves: createEmptyReserves(),
      promotedSquares: { A: [], B: [] },
      captureMaterial: createEmptyCaptureMaterialLedger(),
    };

    const result = validateAndApplyBughouseHalfMove(pos, {
      kind: "normal",
      board: "A",
      from: "e5",
      to: "d6",
    });
    if (result.type !== "ok") throw new Error(`Expected ok, got ${result.type}`);

    expect(result.next.captureMaterial.A.white).toBe(1.5);
    expect(result.next.captureMaterial.A.black).toBe(-1.5);
  });

  it("treats capturing a promoted piece as capturing a pawn (1.5)", () => {
    const pos: BughousePositionSnapshot = {
      // White rook on e1 captures the (promoted) piece on e4.
      fenA: "4k3/8/8/8/4q3/8/8/4R1K1 w - - 0 1",
      fenB: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
      reserves: createEmptyReserves(),
      promotedSquares: { A: ["e4"], B: [] },
      captureMaterial: createEmptyCaptureMaterialLedger(),
    };

    const result = validateAndApplyBughouseHalfMove(pos, {
      kind: "normal",
      board: "A",
      from: "e1",
      to: "e4",
    });
    if (result.type !== "ok") throw new Error(`Expected ok, got ${result.type}`);

    expect(result.next.captureMaterial.A.white).toBe(1.5);
    expect(result.next.captureMaterial.A.black).toBe(-1.5);
  });
});
