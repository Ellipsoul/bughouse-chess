import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnalysisState } from "../../../app/components/useAnalysisState";
import type { BughouseMove } from "../../../app/types/bughouse";

describe("useAnalysisState", () => {
  it("initializes with root node as cursor", () => {
    const { result } = renderHook(() => useAnalysisState());

    expect(result.current.state.cursorNodeId).toBe("root");
    expect(result.current.state.selectedNodeId).toBe("root");
    expect(result.current.state.clockAnchorNodeId).toBe("root");
    expect(result.current.currentNode.id).toBe("root");
  });

  it("applies a move and advances cursor", () => {
    const { result } = renderHook(() => useAnalysisState());

    act(() => {
      const moveResult = result.current.tryApplyMove({
        kind: "normal",
        board: "A",
        from: "e2",
        to: "e4",
      });

      expect(moveResult.type).toBe("ok");
    });

    // Cursor should advance to the new node
    expect(result.current.state.cursorNodeId).not.toBe("root");
    expect(result.current.state.selectedNodeId).not.toBe("root");
    expect(result.current.currentNode.incomingMove).toBeTruthy();
    if (result.current.currentNode.incomingMove) {
      expect(result.current.currentNode.incomingMove.board).toBe("A");
    }
  });

  it("handles promotion flow", () => {
    const { result } = renderHook(() => useAnalysisState());

    // Test that the hook has promotion methods
    expect(typeof result.current.commitPromotion).toBe("function");
    expect(typeof result.current.cancelPendingPromotion).toBe("function");

    // Test cancel promotion
    act(() => {
      result.current.cancelPendingPromotion();
    });

    expect(result.current.state.pendingPromotion).toBeNull();
  });

  it("navigates backward correctly", () => {
    const { result } = renderHook(() => useAnalysisState());

    // Apply a move
    act(() => {
      result.current.tryApplyMove({
        kind: "normal",
        board: "A",
        from: "e2",
        to: "e4",
      });
    });

    // Navigate back
    act(() => {
      result.current.navBack();
    });

    expect(result.current.state.cursorNodeId).toBe("root");
    expect(result.current.state.selectedNodeId).toBe("root");
  });

  it("navigates forward correctly", () => {
    const { result } = renderHook(() => useAnalysisState());

    // Apply a move
    act(() => {
      result.current.tryApplyMove({
        kind: "normal",
        board: "A",
        from: "e2",
        to: "e4",
      });
    });

    // Navigate back first
    act(() => {
      result.current.navBack();
    });

    // Navigate forward
    act(() => {
      result.current.navForwardOrOpenSelector();
    });

    // Should be back on the move node
    expect(result.current.state.cursorNodeId).not.toBe("root");
  });

  it("opens variation selector when multiple children exist", () => {
    const { result } = renderHook(() => useAnalysisState());

    // Apply first move
    act(() => {
      result.current.tryApplyMove({
        kind: "normal",
        board: "A",
        from: "e2",
        to: "e4",
      });
    });

    // Navigate back
    act(() => {
      result.current.navBack();
    });

    // Apply alternative move (creates variation)
    act(() => {
      result.current.tryApplyMove({
        kind: "normal",
        board: "A",
        from: "d2",
        to: "d4",
      });
    });

    // Navigate back to root
    act(() => {
      result.current.selectNode("root");
    });

    // Try to navigate forward - should open selector
    act(() => {
      result.current.navForwardOrOpenSelector();
    });

    expect(result.current.state.variationSelector?.open).toBe(true);
  });

  it("loads game mainline correctly", () => {
    const { result } = renderHook(() => useAnalysisState());

    const combinedMoves: BughouseMove[] = [
      {
        board: "A",
        moveNumber: 1,
        move: "e4",
        timestamp: 5,
        side: "white",
      },
      {
        board: "A",
        moveNumber: 1,
        move: "e5",
        timestamp: 10,
        side: "black",
      },
    ];

    act(() => {
      const loadResult = result.current.loadGameMainline(combinedMoves);
      expect(loadResult.ok).toBe(true);
    });

    // Should have loaded the moves
    expect(result.current.state.cursorNodeId).toBe("root");
    // Tree should have nodes beyond root
    const nodeCount = Object.keys(result.current.state.tree.nodesById).length;
    expect(nodeCount).toBeGreaterThan(1);
  });

  it("promotes variation one level", () => {
    const { result } = renderHook(() => useAnalysisState());

    // Create a variation
    act(() => {
      result.current.tryApplyMove({
        kind: "normal",
        board: "A",
        from: "e2",
        to: "e4",
      });
    });

    act(() => {
      result.current.navBack();
    });

    // Create alternative
    act(() => {
      result.current.tryApplyMove({
        kind: "normal",
        board: "A",
        from: "d2",
        to: "d4",
      });
    });

    const varNodeId = result.current.state.cursorNodeId;

    // Promote variation
    act(() => {
      result.current.promoteVariationOneLevel(varNodeId);
    });

    // The variation should now be the mainline
    const rootNode = result.current.state.tree.nodesById["root"];
    expect(rootNode?.mainChildId).toBe(varNodeId);
  });

  it("truncates after node correctly", () => {
    const { result } = renderHook(() => useAnalysisState());

    // Apply multiple moves
    act(() => {
      result.current.tryApplyMove({
        kind: "normal",
        board: "A",
        from: "e2",
        to: "e4",
      });
    });

    const firstNodeId = result.current.state.cursorNodeId;

    act(() => {
      result.current.tryApplyMove({
        kind: "normal",
        board: "A",
        from: "e7",
        to: "e5",
      });
    });

    const secondNodeId = result.current.state.cursorNodeId;

    // Truncate after first node
    act(() => {
      result.current.truncateAfterNode(firstNodeId);
    });

    // Second node should be deleted
    const firstNode = result.current.state.tree.nodesById[firstNodeId];
    expect(firstNode?.children.length).toBe(0);
    expect(result.current.state.tree.nodesById[secondNodeId]).toBeUndefined();
  });

  it("truncates from node inclusive correctly", () => {
    const { result } = renderHook(() => useAnalysisState());

    // Apply multiple moves
    act(() => {
      result.current.tryApplyMove({
        kind: "normal",
        board: "A",
        from: "e2",
        to: "e4",
      });
    });

    const firstNodeId = result.current.state.cursorNodeId;

    act(() => {
      result.current.tryApplyMove({
        kind: "normal",
        board: "A",
        from: "e7",
        to: "e5",
      });
    });

    // Truncate from first node (inclusive)
    act(() => {
      result.current.truncateFromNodeInclusive(firstNodeId);
    });

    // Both nodes should be deleted
    expect(result.current.state.tree.nodesById[firstNodeId]).toBeUndefined();
    // Cursor should be back at root
    expect(result.current.state.cursorNodeId).toBe("root");
  });

  it("updates clock anchor when on mainline", () => {
    const { result } = renderHook(() => useAnalysisState());

    // Apply move on mainline
    act(() => {
      result.current.tryApplyMove({
        kind: "normal",
        board: "A",
        from: "e2",
        to: "e4",
      });
    });

    // Clock anchor should advance with cursor on mainline
    expect(result.current.state.clockAnchorNodeId).toBe(result.current.state.cursorNodeId);
  });

  it("freezes clock anchor when exploring variation", () => {
    const { result } = renderHook(() => useAnalysisState());

    // Apply mainline move
    act(() => {
      result.current.tryApplyMove({
        kind: "normal",
        board: "A",
        from: "e2",
        to: "e4",
      });
    });

    const mainNodeId = result.current.state.cursorNodeId;
    const anchorBefore = result.current.state.clockAnchorNodeId;
    expect(anchorBefore).toBe(mainNodeId); // Anchor should be at mainline node

    // Navigate back to root
    act(() => {
      result.current.navBack();
    });

    // When navigating back to root, root is on mainline, so anchor resets to root
    expect(result.current.state.clockAnchorNodeId).toBe("root");
    expect(result.current.state.cursorNodeId).toBe("root");

    // Create variation from root
    act(() => {
      result.current.tryApplyMove({
        kind: "normal",
        board: "A",
        from: "d2",
        to: "d4",
      });
    });

    // Clock anchor should remain at root (the mainline position we're branching from)
    expect(result.current.state.clockAnchorNodeId).toBe("root");
    expect(result.current.state.clockAnchorNodeId).not.toBe(result.current.state.cursorNodeId);
  });

  it("handles drop moves correctly", () => {
    const { result } = renderHook(() => useAnalysisState());

    // Set up reserves
    const pos = result.current.currentPosition;
    pos.reserves.A.white.p = 1;

    act(() => {
      const dropResult = result.current.tryApplyMove({
        kind: "drop",
        board: "A",
        side: "white",
        piece: "p",
        to: "e4",
      });

      expect(dropResult.type).toBe("ok");
    });

    // Should have applied the drop
    expect(result.current.state.cursorNodeId).not.toBe("root");
    if (result.current.currentNode.incomingMove) {
      expect(result.current.currentNode.incomingMove.kind).toBe("drop");
    }
  });
});

