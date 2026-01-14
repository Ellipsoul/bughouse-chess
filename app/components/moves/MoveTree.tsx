"use client";

import React, { useCallback, useMemo } from "react";
import type { AnalysisNode, AnalysisTree } from "../../types/analysis";
import { findContainingVariationHeadNodeId } from "../../utils/analysis/findVariationHead";
import { TooltipAnchor } from "../ui/TooltipAnchor";

interface MoveTreeProps {
  tree: AnalysisTree;
  cursorNodeId: string;
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  onPromoteVariationOneLevel: (nodeId: string) => void;
  /**
   * Delete all moves *after* the given node (exclusive).
   * This keeps the selected move itself.
   */
  onTruncateAfterNode: (nodeId: string) => void;
  /**
   * Delete the given node *and* everything after it (inclusive).
   * This removes the selected move itself.
   */
  onTruncateFromNodeInclusive: (nodeId: string) => void;
}

/**
 * Parenthesized variation renderer (analysis-style).
 *
 * Mainline is rendered as the primary line. Any non-main children at a node
 * are rendered beneath in parentheses. Nested variations recurse similarly.
 */
export default function MoveTree({
  tree,
  cursorNodeId,
  selectedNodeId,
  onSelectNode,
  onPromoteVariationOneLevel,
  onTruncateAfterNode,
  onTruncateFromNodeInclusive,
}: MoveTreeProps) {
  const selectedNode = tree.nodesById[selectedNodeId];

  const canPromoteSelected = useMemo(() => {
    const headId = findContainingVariationHeadNodeId(tree.nodesById, selectedNodeId);
    if (!headId) return false;

    const head = tree.nodesById[headId];
    if (!head?.parentId) return false;
    const parent = tree.nodesById[head.parentId];
    if (!parent) return false;
    return parent.mainChildId !== headId;
  }, [selectedNodeId, tree.nodesById]);

  const canTruncateSelectedExclusive = Boolean(
    selectedNode && selectedNodeId !== tree.rootId && selectedNode.children.length > 0,
  );
  const canTruncateSelectedInclusive = Boolean(selectedNode && selectedNodeId !== tree.rootId);

  const renderMoveToken = useCallback(
    (node: AnalysisNode) => {
      const move = node.incomingMove;
      if (!move) return null;

      const isSelected = node.id === selectedNodeId;
      const isCursor = node.id === cursorNodeId;
      const base =
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer select-none " +
        "transition-colors";
      const selectedClass = isSelected ? "bg-amber-200/15 text-amber-200 font-semibold" : "text-gray-200 hover:bg-gray-700/60";
      const cursorClass = isCursor ? "ring-1 ring-amber-200/40" : "";

      return (
        <span
          key={node.id}
          className={`${base} ${selectedClass} ${cursorClass}`}
          role="button"
          tabIndex={0}
          onClick={() => onSelectNode(node.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectNode(node.id);
            }
          }}
          title={`${move.board} ${move.san}`}
        >
          <span className="text-[10px] font-bold text-gray-400">{move.board}</span>
          <span className="leading-5">{move.san}</span>
        </span>
      );
    },
    [cursorNodeId, onSelectNode, selectedNodeId],
  );

  const renderVariationLine = useCallback(
    function renderVariationLine(startNodeId: string): React.ReactNode {
      const startNode = tree.nodesById[startNodeId];
      if (!startNode) return null;

      const tokens: React.ReactNode[] = [];
      let node: AnalysisNode | undefined = startNode;

      // Render this variation's mainline, nesting additional variations inline.
      while (node) {
        const currentNode: AnalysisNode = node;
        tokens.push(renderMoveToken(currentNode));

        const nonMainChildren = currentNode.children.filter(
          (id: string) => id !== currentNode.mainChildId,
        );
        if (nonMainChildren.length > 0) {
          tokens.push(
            <span key={`${currentNode.id}-nested`} className="text-gray-300">
              {" "}
              {nonMainChildren.map((childId: string) => (
                <span key={`${currentNode.id}-${childId}`} className="inline">
                  {"("}
                  {renderVariationLine(childId)}
                  {")"}{" "}
                </span>
              ))}
            </span>,
          );
        }

        const nextId: string | null = currentNode.mainChildId;
        node = nextId ? tree.nodesById[nextId] : undefined;
        if (node) {
          tokens.push(
            <span key={`${node.id}-sp`} className="text-gray-500">
              {" "}
            </span>,
          );
        }
      }

      return <span className="inline">{tokens}</span>;
    },
    [renderMoveToken, tree.nodesById],
  );

  const renderMainlineFrom = useCallback(
    (nodeId: string) => {
      const node = tree.nodesById[nodeId];
      if (!node) return null;

      const mainTokens: React.ReactNode[] = [];
      let current: AnalysisNode | undefined = node;

      while (current?.mainChildId) {
        const currentNode: AnalysisNode = current;
        const mainChildId = currentNode.mainChildId;
        if (!mainChildId) break;
        const mainChild: AnalysisNode | undefined = tree.nodesById[mainChildId];
        if (!mainChild) break;

        // Render main move
        mainTokens.push(renderMoveToken(mainChild));

        // Render variations under this ply
        const nonMainChildren = currentNode.children.filter(
          (id: string) => id !== currentNode.mainChildId,
        );
        if (nonMainChildren.length > 0) {
          mainTokens.push(
            <div
              key={`${currentNode.id}-vars`}
              className="ml-2 mt-1 text-gray-300 text-sm leading-6"
            >
              {nonMainChildren.map((childId: string) => (
                <div key={`${currentNode.id}-${childId}`} className="block">
                  {"("}
                  {renderVariationLine(childId)}
                  {")"}
                </div>
              ))}
            </div>,
          );
        }

        current = mainChild;
      }

      // If the final node has variations (but no main continuation), render them too.
      if (current && current.children.length > 0 && !current.mainChildId) {
        mainTokens.push(
          <div key={`${current.id}-vars`} className="ml-2 mt-1 text-gray-300 text-sm leading-6">
            {current.children.map((childId: string) => (
              <div key={`${current.id}-${childId}`} className="block">
                {"("}
                {renderVariationLine(childId)}
                {")"}
              </div>
            ))}
          </div>,
        );
      }

      return (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap gap-x-1 gap-y-1">{mainTokens}</div>
          {(!node.mainChildId && node.children.length === 0) && (
            <div className="text-gray-500 italic text-sm">No moves yet</div>
          )}
        </div>
      );
    },
    [renderMoveToken, renderVariationLine, tree.nodesById],
  );

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg overflow-hidden border border-gray-700 w-full">
      <div className="border-b border-gray-700 px-3 py-2">
        <div className="text-xs font-semibold text-gray-300 tracking-wide uppercase">
          Move Tree
        </div>
        <div className="mt-2 flex gap-2">
          <TooltipAnchor content="Promote selected variation one level closer to mainline">
            <button
              type="button"
              className="px-2 py-1 text-xs rounded bg-gray-900 border border-gray-700 text-gray-200 disabled:text-gray-500 disabled:border-gray-800 disabled:bg-gray-900/60"
              onClick={() => onPromoteVariationOneLevel(selectedNodeId)}
              disabled={!canPromoteSelected}
            >
              Promote
            </button>
          </TooltipAnchor>
          <TooltipAnchor content="Delete all moves after the selected move">
            <button
              type="button"
              className="px-2 py-1 text-xs rounded bg-gray-900 border border-gray-700 text-gray-200 disabled:text-gray-500 disabled:border-gray-800 disabled:bg-gray-900/60"
              onClick={() => onTruncateAfterNode(selectedNodeId)}
              disabled={!canTruncateSelectedExclusive}
            >
              Delete after here (keep move)
            </button>
          </TooltipAnchor>
          <TooltipAnchor content="Delete the selected move and everything after it">
            <button
              type="button"
              className="px-2 py-1 text-xs rounded bg-gray-900 border border-gray-700 text-gray-200 disabled:text-gray-500 disabled:border-gray-800 disabled:bg-gray-900/60"
              onClick={() => onTruncateFromNodeInclusive(selectedNodeId)}
              disabled={!canTruncateSelectedInclusive}
            >
              Delete from here (include move)
            </button>
          </TooltipAnchor>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        {renderMainlineFrom(tree.rootId)}
      </div>
    </div>
  );
}
