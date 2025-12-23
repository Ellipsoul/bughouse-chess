import { describe, expect, it } from "vitest";
import { createInitialPositionSnapshot, validateAndApplyMoveFromNotation } from "../../../app/utils/analysis/applyMove";
import type { AnalysisNode, AnalysisTree } from "../../../app/types/analysis";
import type { BughouseMove, ProcessedGameData } from "../../../app/types/bughouse";
import { buildBughouseClockTimeline } from "../../../app/utils/analysis/buildBughouseClockTimeline";
import {
  buildBughouseBoardMoveCountsByGlobalPly,
  buildMonotonicMoveTimestampsDeciseconds,
  getBughouseClockSnapshotAtElapsedDeciseconds,
  isPristineLoadedMainline,
} from "../../../app/utils/analysis/liveReplay";

function buildProcessedGame(params: {
  initialTime: number;
  combinedMoves: BughouseMove[];
}): ProcessedGameData {
  return {
    originalGame: { moves: [], timestamps: [] },
    partnerGame: { moves: [], timestamps: [] },
    combinedMoves: params.combinedMoves,
    initialTime: params.initialTime,
    timeIncrement: 0,
    players: {
      aWhite: { username: "aw" },
      aBlack: { username: "ab" },
      bWhite: { username: "bw" },
      bBlack: { username: "bb" },
    },
  };
}

function buildTreeFromCombinedMovesSanitized(combinedMoves: BughouseMove[]): AnalysisTree {
  const rootId = "root";
  const rootPosition = createInitialPositionSnapshot();
  const nodesById: Record<string, AnalysisNode> = {
    [rootId]: {
      id: rootId,
      parentId: null,
      position: rootPosition,
      children: [],
      mainChildId: null,
    },
  };

  let cursorId = rootId;
  let position = rootPosition;

  for (let i = 0; i < combinedMoves.length; i += 1) {
    const mv = combinedMoves[i]!;
    const applied = validateAndApplyMoveFromNotation(position, {
      board: mv.board,
      side: mv.side,
      move: mv.move,
    });
    if (applied.type !== "ok") {
      throw new Error(`Failed to apply move ${mv.board} ${mv.side} ${mv.move}`);
    }

    const nextId = `n${i + 1}`;
    const parent = nodesById[cursorId]!;
    const nextNode: AnalysisNode = {
      id: nextId,
      parentId: parent.id,
      incomingMove: applied.move,
      position: applied.next,
      children: [],
      mainChildId: null,
    };

    parent.children = [...parent.children, nextId];
    parent.mainChildId = parent.mainChildId ?? nextId;
    nodesById[parent.id] = parent;
    nodesById[nextId] = nextNode;

    cursorId = nextId;
    position = applied.next;
  }

  return { rootId, nodesById };
}

describe("liveReplay utilities", () => {
  it("getBughouseClockSnapshotAtElapsedDeciseconds matches discrete timeline at exact move timestamps", () => {
    // Simple: a few moves on alternating boards with monotonic timestamps.
    const combinedMoves: BughouseMove[] = [
      { board: "A", side: "white", moveNumber: 1, move: "e4", timestamp: 10 },
      { board: "B", side: "white", moveNumber: 1, move: "d4", timestamp: 20 },
      { board: "A", side: "black", moveNumber: 1, move: "e5", timestamp: 35 },
    ];

    const processed = buildProcessedGame({ initialTime: 1800, combinedMoves });
    const { timeline } = buildBughouseClockTimeline(processed);
    const ts = buildMonotonicMoveTimestampsDeciseconds(combinedMoves);
    const counts = buildBughouseBoardMoveCountsByGlobalPly(combinedMoves);

    // timeline[0] is start; timeline[i+1] is after move i.
    for (let i = 0; i < combinedMoves.length; i += 1) {
      const t = ts[i]!;
      const continuous = getBughouseClockSnapshotAtElapsedDeciseconds({
        timeline,
        monotonicMoveTimestamps: ts,
        boardMoveCountsByGlobalPly: counts,
        elapsedDeciseconds: t,
      });
      expect(continuous).toEqual(timeline[i + 1]);
    }
  });

  it("buildMonotonicMoveTimestampsDeciseconds clamps regressions to preserve monotonic time", () => {
    const combinedMoves: BughouseMove[] = [
      { board: "A", side: "white", moveNumber: 1, move: "e4", timestamp: 10 },
      { board: "B", side: "white", moveNumber: 1, move: "d4", timestamp: 5 }, // regression
      { board: "A", side: "black", moveNumber: 1, move: "e5", timestamp: 12 },
    ];
    const ts = buildMonotonicMoveTimestampsDeciseconds(combinedMoves);
    expect(ts).toEqual([10, 10, 12]);
  });

  it("isPristineLoadedMainline returns true only when mainline exactly matches loaded SAN line", () => {
    const combinedMoves: BughouseMove[] = [
      { board: "A", side: "white", moveNumber: 1, move: "e4", timestamp: 10 },
      { board: "A", side: "black", moveNumber: 1, move: "e5", timestamp: 20 },
    ];

    const tree = buildTreeFromCombinedMovesSanitized(combinedMoves);
    expect(isPristineLoadedMainline({ tree, combinedMoves })).toBe(true);

    // Make it non-pristine by truncating (remove continuation from first move).
    const n1 = tree.nodesById["n1"]!;
    const truncated: AnalysisTree = {
      ...tree,
      nodesById: {
        ...tree.nodesById,
        n1: { ...n1, children: [], mainChildId: null },
      },
    };
    expect(isPristineLoadedMainline({ tree: truncated, combinedMoves })).toBe(false);
  });
});


