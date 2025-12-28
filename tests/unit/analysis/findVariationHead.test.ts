import { describe, it, expect } from "vitest";
import { findContainingVariationHeadNodeId } from "../../../app/utils/analysis/findVariationHead";
import { createEmptyCaptureMaterialLedger } from "../../../app/utils/analysis/captureMaterial";
import type { AnalysisTree } from "../../../app/types/analysis";

describe("findContainingVariationHeadNodeId", () => {
  it("returns null for root node", () => {
    const tree: AnalysisTree = {
      rootId: "root",
      nodesById: {
        root: {
          id: "root",
          parentId: null,
          position: {
            fenA: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            fenB: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            reserves: { A: { white: {}, black: {} }, B: { white: {}, black: {} } },
            promotedSquares: { A: [], B: [] },
            captureMaterial: createEmptyCaptureMaterialLedger(),
          },
          children: [],
          mainChildId: null,
        },
      },
    };

    const result = findContainingVariationHeadNodeId(tree.nodesById, "root");
    expect(result).toBeNull();
  });

  it("returns null for node on mainline", () => {
    const tree: AnalysisTree = {
      rootId: "root",
      nodesById: {
        root: {
          id: "root",
          parentId: null,
          position: {
            fenA: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            fenB: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            reserves: { A: { white: {}, black: {} }, B: { white: {}, black: {} } },
            promotedSquares: { A: [], B: [] },
            captureMaterial: createEmptyCaptureMaterialLedger(),
          },
          children: ["main1"],
          mainChildId: "main1",
        },
        main1: {
          id: "main1",
          parentId: "root",
          incomingMove: {
            board: "A",
            side: "white",
            kind: "normal",
            san: "e4",
            key: "A:normal:e2-e4",
            normal: { from: "e2", to: "e4" },
          },
          position: {
            fenA: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e3 0 1",
            fenB: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            reserves: { A: { white: {}, black: {} }, B: { white: {}, black: {} } },
            promotedSquares: { A: [], B: [] },
            captureMaterial: createEmptyCaptureMaterialLedger(),
          },
          children: [],
          mainChildId: null,
        },
      },
    };

    const result = findContainingVariationHeadNodeId(tree.nodesById, "main1");
    expect(result).toBeNull();
  });

  it("returns variation head when node is a variation", () => {
    const tree: AnalysisTree = {
      rootId: "root",
      nodesById: {
        root: {
          id: "root",
          parentId: null,
          position: {
            fenA: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            fenB: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            reserves: { A: { white: {}, black: {} }, B: { white: {}, black: {} } },
            promotedSquares: { A: [], B: [] },
            captureMaterial: createEmptyCaptureMaterialLedger(),
          },
          children: ["main1", "var1"],
          mainChildId: "main1",
        },
        main1: {
          id: "main1",
          parentId: "root",
          incomingMove: {
            board: "A",
            side: "white",
            kind: "normal",
            san: "e4",
            key: "A:normal:e2-e4",
            normal: { from: "e2", to: "e4" },
          },
          position: {
            fenA: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e3 0 1",
            fenB: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            reserves: { A: { white: {}, black: {} }, B: { white: {}, black: {} } },
            promotedSquares: { A: [], B: [] },
            captureMaterial: createEmptyCaptureMaterialLedger(),
          },
          children: [],
          mainChildId: null,
        },
        var1: {
          id: "var1",
          parentId: "root",
          incomingMove: {
            board: "A",
            side: "white",
            kind: "normal",
            san: "d4",
            key: "A:normal:d2-d4",
            normal: { from: "d2", to: "d4" },
          },
          position: {
            fenA: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq d3 0 1",
            fenB: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            reserves: { A: { white: {}, black: {} }, B: { white: {}, black: {} } },
            promotedSquares: { A: [], B: [] },
            captureMaterial: createEmptyCaptureMaterialLedger(),
          },
          children: [],
          mainChildId: null,
        },
      },
    };

    const result = findContainingVariationHeadNodeId(tree.nodesById, "var1");
    expect(result).toBe("var1");
  });

  it("returns variation head when node is deep in variation", () => {
    const tree: AnalysisTree = {
      rootId: "root",
      nodesById: {
        root: {
          id: "root",
          parentId: null,
          position: {
            fenA: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            fenB: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            reserves: { A: { white: {}, black: {} }, B: { white: {}, black: {} } },
            promotedSquares: { A: [], B: [] },
            captureMaterial: createEmptyCaptureMaterialLedger(),
          },
          children: ["main1", "var1"],
          mainChildId: "main1",
        },
        main1: {
          id: "main1",
          parentId: "root",
          incomingMove: {
            board: "A",
            side: "white",
            kind: "normal",
            san: "e4",
            key: "A:normal:e2-e4",
            normal: { from: "e2", to: "e4" },
          },
          position: {
            fenA: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e3 0 1",
            fenB: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            reserves: { A: { white: {}, black: {} }, B: { white: {}, black: {} } },
            promotedSquares: { A: [], B: [] },
            captureMaterial: createEmptyCaptureMaterialLedger(),
          },
          children: [],
          mainChildId: null,
        },
        var1: {
          id: "var1",
          parentId: "root",
          incomingMove: {
            board: "A",
            side: "white",
            kind: "normal",
            san: "d4",
            key: "A:normal:d2-d4",
            normal: { from: "d2", to: "d4" },
          },
          position: {
            fenA: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq d3 0 1",
            fenB: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            reserves: { A: { white: {}, black: {} }, B: { white: {}, black: {} } },
            promotedSquares: { A: [], B: [] },
            captureMaterial: createEmptyCaptureMaterialLedger(),
          },
          children: ["var1child"],
          mainChildId: "var1child",
        },
        var1child: {
          id: "var1child",
          parentId: "var1",
          incomingMove: {
            board: "A",
            side: "black",
            kind: "normal",
            san: "d5",
            key: "A:normal:d7-d5",
            normal: { from: "d7", to: "d5" },
          },
          position: {
            fenA: "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq d6 0 2",
            fenB: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            reserves: { A: { white: {}, black: {} }, B: { white: {}, black: {} } },
            promotedSquares: { A: [], B: [] },
            captureMaterial: createEmptyCaptureMaterialLedger(),
          },
          children: [],
          mainChildId: null,
        },
      },
    };

    const result = findContainingVariationHeadNodeId(tree.nodesById, "var1child");
    expect(result).toBe("var1");
  });

  it("returns null for invalid node ID", () => {
    const tree: AnalysisTree = {
      rootId: "root",
      nodesById: {
        root: {
          id: "root",
          parentId: null,
          position: {
            fenA: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            fenB: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            reserves: { A: { white: {}, black: {} }, B: { white: {}, black: {} } },
            promotedSquares: { A: [], B: [] },
            captureMaterial: createEmptyCaptureMaterialLedger(),
          },
          children: [],
          mainChildId: null,
        },
      },
    };

    const result = findContainingVariationHeadNodeId(tree.nodesById, "nonexistent");
    expect(result).toBeNull();
  });
});
