import { describe, expect, it } from "vitest";
import { BughouseReplayController } from "../../../app/utils/replayController";
import type { ProcessedGameData } from "../../../app/types/bughouse";

function createMinimalProcessedGameData(params: {
  combinedMoves: ProcessedGameData["combinedMoves"];
}): ProcessedGameData {
  return {
    originalGame: { moves: [], timestamps: [] },
    partnerGame: { moves: [], timestamps: [] },
    combinedMoves: params.combinedMoves,
    initialTime: 3000,
    timeIncrement: 0,
    players: {
      aWhite: { username: "aWhite" },
      aBlack: { username: "aBlack" },
      bWhite: { username: "bWhite" },
      bBlack: { username: "bBlack" },
    },
  };
}

describe("BughouseReplayController - captureMaterial", () => {
  it("updates capture material on capture and restores it on moveBackward()", () => {
    const processed = createMinimalProcessedGameData({
      combinedMoves: [
        { board: "A", moveNumber: 1, move: "e4", timestamp: 1, side: "white" },
        { board: "A", moveNumber: 1, move: "d5", timestamp: 2, side: "black" },
        { board: "A", moveNumber: 2, move: "exd5", timestamp: 3, side: "white" }, // capture
      ],
    });

    const controller = new BughouseReplayController(processed);

    // Start position.
    expect(controller.getCurrentGameState().captureMaterial.A.white).toBe(0);
    expect(controller.getCurrentGameState().captureMaterial.A.black).toBe(0);

    expect(controller.moveForward()).toBe(true); // e4
    expect(controller.moveForward()).toBe(true); // d5
    expect(controller.moveForward()).toBe(true); // exd5

    const afterCapture = controller.getCurrentGameState().captureMaterial;
    expect(afterCapture.A.white).toBe(1);
    expect(afterCapture.A.black).toBe(-1);

    // Undo the capture: should restore previous ledger state.
    expect(controller.moveBackward()).toBe(true);
    const afterUndo = controller.getCurrentGameState().captureMaterial;
    expect(afterUndo.A.white).toBe(0);
    expect(afterUndo.A.black).toBe(0);
  });
});
