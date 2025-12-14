import { useCallback, useMemo, useReducer } from "react";
import type { Square } from "chess.js";
import type { BughouseMove } from "../types/bughouse";
import type {
  AnalysisNode,
  AnalysisTree,
  AttemptedBughouseHalfMove,
  BughouseBoardId,
  BughouseHalfMove,
  BughousePositionSnapshot,
  BughousePromotionPiece,
} from "../types/analysis";
import {
  createInitialPositionSnapshot,
  validateAndApplyBughouseHalfMove,
  validateAndApplyMoveFromNotation,
  type ValidateAndApplyResult,
} from "../utils/analysis/applyMove";

export interface PendingDropSelection {
  board: BughouseBoardId;
  side: "white" | "black";
  piece: "p" | "n" | "b" | "r" | "q";
}

export interface VariationSelectorState {
  open: boolean;
  nodeId: string;
  selectedChildIndex: number;
}

export interface PendingPromotionState {
  board: BughouseBoardId;
  from: Square;
  to: Square;
  allowed: BughousePromotionPiece[];
}

export interface AnalysisState {
  tree: AnalysisTree;
  cursorNodeId: string;
  selectedNodeId: string;
  pendingDrop: PendingDropSelection | null;
  variationSelector: VariationSelectorState | null;
  pendingPromotion: PendingPromotionState | null;
}

type ReplaceTreePayload = {
  tree: AnalysisTree;
  cursorNodeId: string;
  selectedNodeId: string;
};

type Action =
  | { type: "REPLACE_TREE"; payload: ReplaceTreePayload }
  | { type: "SET_CURSOR"; nodeId: string }
  | { type: "SET_SELECTED"; nodeId: string }
  | { type: "SET_PENDING_DROP"; pendingDrop: PendingDropSelection | null }
  | { type: "OPEN_VARIATION_SELECTOR"; nodeId: string; selectedChildIndex: number }
  | { type: "CLOSE_VARIATION_SELECTOR" }
  | { type: "SET_VARIATION_SELECTOR_INDEX"; selectedChildIndex: number }
  | { type: "SET_PENDING_PROMOTION"; pendingPromotion: PendingPromotionState | null }
  | { type: "APPLY_MOVE_EDGE"; move: BughouseHalfMove; next: BughousePositionSnapshot };

function createIdFactory() {
  let counter = 0;
  return () => {
    counter += 1;
    // Avoid relying solely on crypto for environments/tests where it may not exist.
    const rand =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(16).slice(2);
    return `node_${counter}_${rand}`;
  };
}

function createInitialTree(): AnalysisTree {
  const rootId = "root";
  const rootPosition = createInitialPositionSnapshot();
  return {
    rootId,
    nodesById: {
      [rootId]: {
        id: rootId,
        parentId: null,
        position: rootPosition,
        children: [],
        mainChildId: null,
      },
    },
  };
}

/**
 * Internal extension of AnalysisState used only by the reducer implementation.
 * We keep the ID factory stable without threading it through every action.
 */
type InternalState = AnalysisState & { _internalCreateId: () => string };

function reducer(state: InternalState, action: Action): InternalState {
  switch (action.type) {
    case "REPLACE_TREE": {
      return {
        ...state,
        tree: action.payload.tree,
        cursorNodeId: action.payload.cursorNodeId,
        selectedNodeId: action.payload.selectedNodeId,
        pendingDrop: null,
        variationSelector: null,
        pendingPromotion: null,
      };
    }
    case "SET_CURSOR":
      return { ...state, cursorNodeId: action.nodeId };
    case "SET_SELECTED":
      return { ...state, selectedNodeId: action.nodeId };
    case "SET_PENDING_DROP":
      return { ...state, pendingDrop: action.pendingDrop };
    case "OPEN_VARIATION_SELECTOR":
      return {
        ...state,
        variationSelector: {
          open: true,
          nodeId: action.nodeId,
          selectedChildIndex: action.selectedChildIndex,
        },
      };
    case "CLOSE_VARIATION_SELECTOR":
      return { ...state, variationSelector: null };
    case "SET_VARIATION_SELECTOR_INDEX":
      return state.variationSelector
        ? {
            ...state,
            variationSelector: {
              ...state.variationSelector,
              selectedChildIndex: action.selectedChildIndex,
            },
          }
        : state;
    case "SET_PENDING_PROMOTION":
      return { ...state, pendingPromotion: action.pendingPromotion };
    case "APPLY_MOVE_EDGE": {
      const parent = state.tree.nodesById[state.cursorNodeId];
      if (!parent) return state;

      // If this exact move already exists as a child, just advance the cursor.
      const existingChildId = parent.children.find((childId) => {
        const child = state.tree.nodesById[childId];
        return child?.incomingMove?.key === action.move.key;
      });
      if (existingChildId) {
        return {
          ...state,
          cursorNodeId: existingChildId,
          selectedNodeId: existingChildId,
          pendingDrop: null,
          variationSelector: null,
          pendingPromotion: null,
        };
      }

      const newId = state._internalCreateId();
      const newNode: AnalysisNode = {
        id: newId,
        parentId: parent.id,
        incomingMove: action.move,
        position: action.next,
        children: [],
        mainChildId: null,
      };

      const nextParent: AnalysisNode = {
        ...parent,
        children: [...parent.children, newId],
        mainChildId: parent.mainChildId ?? newId,
      };

      return {
        ...state,
        tree: {
          ...state.tree,
          nodesById: {
            ...state.tree.nodesById,
            [parent.id]: nextParent,
            [newId]: newNode,
          },
        },
        cursorNodeId: newId,
        selectedNodeId: newId,
        pendingDrop: null,
        variationSelector: null,
        pendingPromotion: null,
      };
    }
    default:
      return state;
  }
}

export interface UseAnalysisStateResult {
  state: AnalysisState;
  currentNode: AnalysisNode;
  currentPosition: BughousePositionSnapshot;
  /**
   * Attempt to apply a move at the current cursor node.
   * The returned result is suitable for immediate UI feedback (toast, modal, etc.).
   */
  tryApplyMove: (attempted: AttemptedBughouseHalfMove) => ValidateAndApplyResult;
  /**
   * Load a chess.com game into the analysis tree as the mainline, overwriting current analysis.
   */
  loadGameMainline: (combinedMoves: BughouseMove[]) => { ok: true } | { ok: false; message: string };
  selectNode: (nodeId: string) => void;
  navBack: () => void;
  navForwardOrOpenSelector: () => void;
  closeVariationSelector: () => void;
  moveVariationSelectorIndex: (delta: number) => void;
  setVariationSelectorIndex: (index: number) => void;
  acceptVariationSelector: () => void;
  setPendingDrop: (pending: PendingDropSelection | null) => void;
  cancelPendingPromotion: () => void;
  commitPromotion: (promotion: BughousePromotionPiece) => ValidateAndApplyResult;
  promoteVariationOneLevel: (nodeId: string) => void;
  truncateAfterNode: (nodeId: string) => void;
}

/**
 * Reducer-based store for the analysis tree.
 *
 * Design goals:
 * - deterministic (pure reducer)
 * - UI-friendly (cursor + selection separate)
 * - future-proof for adding annotations/engine eval/etc.
 */
export function useAnalysisState(): UseAnalysisStateResult {
  const createId = useMemo(() => createIdFactory(), []);

  const [internalState, dispatch] = useReducer(
    (s: InternalState, a: Action) => reducer(s, a) as InternalState,
    undefined,
    () => {
      const tree = createInitialTree();
      const rootId = tree.rootId;
      return {
        tree,
        cursorNodeId: rootId,
        selectedNodeId: rootId,
        pendingDrop: null,
        variationSelector: null,
        pendingPromotion: null,
        _internalCreateId: createId,
      } satisfies InternalState;
    },
  );

  const state: AnalysisState = useMemo(() => {
    // Hide the internal field from consumers.
    const { _internalCreateId: internalCreateId, ...publicState } = internalState;
    void internalCreateId;
    return publicState;
  }, [internalState]);

  const currentNode = internalState.tree.nodesById[internalState.cursorNodeId] ?? internalState.tree.nodesById[internalState.tree.rootId];
  const currentPosition = currentNode.position;

  const tryApplyMove = useCallback(
    (attempted: AttemptedBughouseHalfMove): ValidateAndApplyResult => {
      const result = validateAndApplyBughouseHalfMove(currentPosition, attempted);
      if (result.type === "ok") {
        dispatch({ type: "APPLY_MOVE_EDGE", move: result.move, next: result.next });
      } else if (result.type === "needs_promotion" && attempted.kind === "normal") {
        dispatch({
          type: "SET_PENDING_PROMOTION",
          pendingPromotion: {
            board: attempted.board,
            from: attempted.from,
            to: attempted.to,
            allowed: result.allowed,
          },
        });
      }
      return result;
    },
    [currentPosition],
  );

  const commitPromotion = useCallback(
    (promotion: BughousePromotionPiece): ValidateAndApplyResult => {
      const pending = state.pendingPromotion;
      if (!pending) return { type: "error", message: "No promotion pending." };
      const result = tryApplyMove({
        kind: "normal",
        board: pending.board,
        from: pending.from,
        to: pending.to,
        promotion,
      });
      if (result.type === "ok" || result.type === "error") {
        dispatch({ type: "SET_PENDING_PROMOTION", pendingPromotion: null });
      }
      return result;
    },
    [state.pendingPromotion, tryApplyMove],
  );

  const cancelPendingPromotion = useCallback(() => {
    dispatch({ type: "SET_PENDING_PROMOTION", pendingPromotion: null });
  }, []);

  const loadGameMainline = useCallback(
    (combinedMoves: BughouseMove[]): { ok: true } | { ok: false; message: string } => {
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

      for (const move of combinedMoves) {
        const applied = validateAndApplyMoveFromNotation(position, {
          board: move.board,
          side: move.side,
          move: move.move,
        });
        if (applied.type !== "ok") {
          return {
            ok: false,
            message:
              applied.type === "needs_promotion"
                ? `Loaded game requires a promotion choice at ${move.board} ${move.move}.`
                : `Failed to load move "${move.move}" on board ${move.board}: ${applied.message}`,
          };
        }

        const nextId = createId();
        const parent = nodesById[cursorId];
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

      const tree: AnalysisTree = { rootId, nodesById };
      dispatch({
        type: "REPLACE_TREE",
        payload: { tree, cursorNodeId: cursorId, selectedNodeId: cursorId },
      });
      return { ok: true };
    },
    [createId],
  );

  const selectNode = useCallback((nodeId: string) => {
    dispatch({ type: "SET_CURSOR", nodeId });
    dispatch({ type: "SET_SELECTED", nodeId });
  }, []);

  const navBack = useCallback(() => {
    if (state.variationSelector?.open) {
      dispatch({ type: "CLOSE_VARIATION_SELECTOR" });
      return;
    }
    const node = internalState.tree.nodesById[internalState.cursorNodeId];
    if (!node?.parentId) return;
    dispatch({ type: "SET_CURSOR", nodeId: node.parentId });
    dispatch({ type: "SET_SELECTED", nodeId: node.parentId });
  }, [internalState.cursorNodeId, internalState.tree.nodesById, state.variationSelector?.open]);

  const navForwardOrOpenSelector = useCallback(() => {
    if (state.variationSelector?.open) {
      return;
    }
    const node = internalState.tree.nodesById[internalState.cursorNodeId];
    if (!node || node.children.length === 0) return;
    if (node.children.length === 1) {
      const nextId = node.children[0];
      dispatch({ type: "SET_CURSOR", nodeId: nextId });
      dispatch({ type: "SET_SELECTED", nodeId: nextId });
      return;
    }
    const mainIndex = node.mainChildId ? node.children.indexOf(node.mainChildId) : 0;
    dispatch({
      type: "OPEN_VARIATION_SELECTOR",
      nodeId: node.id,
      selectedChildIndex: Math.max(0, mainIndex),
    });
  }, [internalState.cursorNodeId, internalState.tree.nodesById, state.variationSelector?.open]);

  const closeVariationSelector = useCallback(() => {
    dispatch({ type: "CLOSE_VARIATION_SELECTOR" });
  }, []);

  const moveVariationSelectorIndex = useCallback(
    (delta: number) => {
      const selector = state.variationSelector;
      if (!selector?.open) return;
      const node = internalState.tree.nodesById[selector.nodeId];
      if (!node) return;
      const count = node.children.length;
      if (count <= 0) return;
      const nextIndex = (selector.selectedChildIndex + delta + count) % count;
      dispatch({ type: "SET_VARIATION_SELECTOR_INDEX", selectedChildIndex: nextIndex });
    },
    [internalState.tree.nodesById, state.variationSelector],
  );

  const setVariationSelectorIndex = useCallback(
    (index: number) => {
      const selector = state.variationSelector;
      if (!selector?.open) return;
      const node = internalState.tree.nodesById[selector.nodeId];
      if (!node) return;
      const count = node.children.length;
      if (count <= 0) return;
      const nextIndex = Math.min(Math.max(index, 0), count - 1);
      dispatch({ type: "SET_VARIATION_SELECTOR_INDEX", selectedChildIndex: nextIndex });
    },
    [internalState.tree.nodesById, state.variationSelector],
  );

  const acceptVariationSelector = useCallback(() => {
    const selector = state.variationSelector;
    if (!selector?.open) return;
    const node = internalState.tree.nodesById[selector.nodeId];
    if (!node) return;
    const childId = node.children[selector.selectedChildIndex];
    if (!childId) return;
    dispatch({ type: "CLOSE_VARIATION_SELECTOR" });
    dispatch({ type: "SET_CURSOR", nodeId: childId });
    dispatch({ type: "SET_SELECTED", nodeId: childId });
  }, [internalState.tree.nodesById, state.variationSelector]);

  const setPendingDrop = useCallback((pending: PendingDropSelection | null) => {
    dispatch({ type: "SET_PENDING_DROP", pendingDrop: pending });
  }, []);

  const promoteVariationOneLevel = useCallback(
    (nodeId: string) => {
      const node = internalState.tree.nodesById[nodeId];
      if (!node?.parentId) return;
      const parent = internalState.tree.nodesById[node.parentId];
      if (!parent) return;
      if (!parent.children.includes(nodeId)) return;
      if (parent.mainChildId === nodeId) return;

      const nextParent: AnalysisNode = { ...parent, mainChildId: nodeId };
      dispatch({
        type: "REPLACE_TREE",
        payload: {
          tree: {
            ...internalState.tree,
            nodesById: {
              ...internalState.tree.nodesById,
              [nextParent.id]: nextParent,
            },
          },
          cursorNodeId: internalState.cursorNodeId,
          selectedNodeId: state.selectedNodeId,
        },
      });
    },
    [internalState.cursorNodeId, internalState.tree, state.selectedNodeId],
  );

  const truncateAfterNode = useCallback(
    (nodeId: string) => {
      const node = internalState.tree.nodesById[nodeId];
      if (!node) return;

      const toDelete = collectDescendants(internalState.tree.nodesById, nodeId);
      const nextNodes: Record<string, AnalysisNode> = { ...internalState.tree.nodesById };
      for (const delId of toDelete) {
        delete nextNodes[delId];
      }

      const nextNode: AnalysisNode = { ...node, children: [], mainChildId: null };
      nextNodes[nodeId] = nextNode;

      dispatch({
        type: "REPLACE_TREE",
        payload: {
          tree: { rootId: internalState.tree.rootId, nodesById: nextNodes },
          cursorNodeId: nodeId,
          selectedNodeId: nodeId,
        },
      });
    },
    [internalState.tree],
  );

  return {
    state,
    currentNode,
    currentPosition,
    tryApplyMove,
    loadGameMainline,
    selectNode,
    navBack,
    navForwardOrOpenSelector,
    closeVariationSelector,
    moveVariationSelectorIndex,
    setVariationSelectorIndex,
    acceptVariationSelector,
    setPendingDrop,
    cancelPendingPromotion,
    commitPromotion,
    promoteVariationOneLevel,
    truncateAfterNode,
  };
}

function collectDescendants(nodesById: Record<string, AnalysisNode>, nodeId: string): string[] {
  const node = nodesById[nodeId];
  if (!node) return [];
  const result: string[] = [];
  const stack = [...node.children];
  while (stack.length) {
    const next = stack.pop();
    if (!next) continue;
    const child = nodesById[next];
    if (!child) continue;
    result.push(next);
    stack.push(...child.children);
  }
  return result;
}

