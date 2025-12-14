"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import type { BughousePlayer } from "../types/bughouse";
import type { AnalysisNode, AnalysisTree } from "../types/analysis";

interface MoveListWithVariationsProps {
  tree: AnalysisTree;
  cursorNodeId: string;
  selectedNodeId: string;
  players: {
    aWhite: BughousePlayer;
    aBlack: BughousePlayer;
    bWhite: BughousePlayer;
    bBlack: BughousePlayer;
  };
  onSelectNode: (nodeId: string) => void;
  onPromoteVariationOneLevel: (nodeId: string) => void;
  onTruncateAfterNode: (nodeId: string) => void;
}

type MainlineRow = {
  nodeId: string;
  nodeBeforeId: string;
  node: AnalysisNode;
  alternativeChildIds: string[];
};

/**
 * Hybrid move list:
 * - Mainline stays in the existing 4-column grid (A white/black, B white/black).
 * - Variations render as parenthesized inline text blocks *below the relevant mainline move*.
 * - After the variation block, the grid continues.
 */
export default function MoveListWithVariations({
  tree,
  cursorNodeId,
  selectedNodeId,
  players,
  onSelectNode,
  onPromoteVariationOneLevel,
  onTruncateAfterNode,
}: MoveListWithVariationsProps) {
  const selectedNode = tree.nodesById[selectedNodeId];

  const canPromoteSelected = useMemo(() => {
    if (!selectedNode?.parentId) return false;
    const parent = tree.nodesById[selectedNode.parentId];
    if (!parent) return false;
    return parent.mainChildId !== selectedNodeId;
  }, [selectedNode?.parentId, selectedNodeId, tree.nodesById]);

  const canTruncateSelected = Boolean(selectedNode && selectedNodeId !== tree.rootId);

  const mainline = useMemo<MainlineRow[]>(() => {
    const rows: MainlineRow[] = [];
    let nodeId = tree.rootId;

    while (true) {
      const nodeBefore = tree.nodesById[nodeId];
      if (!nodeBefore?.mainChildId) break;
      const childId = nodeBefore.mainChildId;
      const child = tree.nodesById[childId];
      if (!child?.incomingMove) break;

      rows.push({
        nodeId: childId,
        nodeBeforeId: nodeId,
        node: child,
        alternativeChildIds: nodeBefore.children.filter((id) => id !== childId),
      });

      nodeId = childId;
    }

    return rows;
  }, [tree.nodesById, tree.rootId]);

  const activeElementRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableSectionElement>(null);

  const cursorRowIndex = useMemo(() => {
    if (cursorNodeId === tree.rootId) return -1;
    return mainline.findIndex((r) => r.nodeId === cursorNodeId);
  }, [cursorNodeId, mainline, tree.rootId]);

  const setActiveElementRef = useCallback(
    (nodeId: string) => (element: HTMLElement | null) => {
      if (nodeId !== cursorNodeId) return;
      if (element) {
        activeElementRef.current = element;
      }
    },
    [cursorNodeId],
  );

  // Scroll active element into view when cursor changes (mainline or variation).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const headerHeight = headerRef.current?.offsetHeight ?? 0;
    const padding = 8;

    if (cursorNodeId === tree.rootId) {
      container.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const element = activeElementRef.current;
    if (!element) return;

    // Use bounding rect math so this works for both <tr> and nested <span> tokens.
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const elementTop = elementRect.top - containerRect.top + container.scrollTop;
    const elementBottom = elementTop + elementRect.height;
    const viewTop = container.scrollTop + headerHeight + padding;
    const viewBottom = container.scrollTop + container.clientHeight - padding;

    if (elementTop < viewTop) {
      container.scrollTo({
        top: elementTop - headerHeight - padding,
        behavior: "smooth",
      });
    } else if (elementBottom > viewBottom) {
      container.scrollTo({
        top: elementBottom - container.clientHeight + padding,
        behavior: "smooth",
      });
    }
  }, [cursorNodeId, cursorRowIndex, tree.rootId]);

  const renderPlayerHeader = useCallback((player: BughousePlayer) => {
    return (
      <div className="flex items-center justify-center gap-1 min-w-0">
        <span className="truncate min-w-0" title={player.username}>
          {player.username}
        </span>
      </div>
    );
  }, []);

  const renderMoveToken = useCallback(
    (nodeId: string) => {
      const node = tree.nodesById[nodeId];
      const move = node?.incomingMove;
      if (!node || !move) return null;

      const isSelected = nodeId === selectedNodeId;
      const isCursor = nodeId === cursorNodeId;

      return (
        <span
          key={nodeId}
          ref={isCursor ? setActiveElementRef(nodeId) : undefined}
          className={[
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer select-none transition-colors",
            isSelected ? "bg-amber-200/15 text-amber-200 font-semibold" : "text-gray-200 hover:bg-gray-700/60",
            isCursor ? "ring-1 ring-amber-200/40" : "",
          ].join(" ")}
          role="button"
          tabIndex={0}
          onClick={() => onSelectNode(nodeId)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectNode(nodeId);
            }
          }}
          title={`${move.board} ${move.san}`}
        >
          <span className="text-[10px] font-bold text-gray-400">{move.board}</span>
          <span className="leading-5">{move.san}</span>
        </span>
      );
    },
    [cursorNodeId, onSelectNode, selectedNodeId, setActiveElementRef, tree.nodesById],
  );

  const renderVariationLine = useCallback(
    function renderVariationLine(startNodeId: string): React.ReactNode {
      const startNode = tree.nodesById[startNodeId];
      if (!startNode) return null;

      const tokens: React.ReactNode[] = [];
      let node: AnalysisNode | undefined = startNode;

      while (node) {
        const current: AnalysisNode = node;
        tokens.push(renderMoveToken(current.id));

        const nonMainChildren = current.children.filter(
          (id: string) => id !== current.mainChildId,
        );
        if (nonMainChildren.length > 0) {
          tokens.push(
            <span key={`${current.id}-nested`} className="text-gray-300">
              {" "}
              {nonMainChildren.map((childId: string) => (
                <span key={`${current.id}-${childId}`} className="inline">
                  {"("}
                  {renderVariationLine(childId)}
                  {")"}{" "}
                </span>
              ))}
            </span>,
          );
        }

        const nextId: string | null = current.mainChildId;
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

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg overflow-hidden border border-gray-700 w-full">
      <div className="border-b border-gray-700 px-3 py-2">
        <div className="text-xs font-semibold text-gray-300 tracking-wide uppercase">
          Moves
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="px-2 py-1 text-xs rounded bg-gray-900 border border-gray-700 text-gray-200 disabled:text-gray-500 disabled:border-gray-800 disabled:bg-gray-900/60"
            onClick={() => onPromoteVariationOneLevel(selectedNodeId)}
            disabled={!canPromoteSelected}
            title="Promote selected variation one level closer to mainline"
          >
            Promote
          </button>
          <button
            type="button"
            className="px-2 py-1 text-xs rounded bg-gray-900 border border-gray-700 text-gray-200 disabled:text-gray-500 disabled:border-gray-800 disabled:bg-gray-900/60"
            onClick={() => onTruncateAfterNode(selectedNodeId)}
            disabled={!canTruncateSelected}
            title="Delete all moves after the selected move"
          >
            Truncate after
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 relative"
      >
        <table className="w-full text-sm border-collapse table-fixed">
          <thead ref={headerRef} className="sticky top-0 z-10 shadow-md">
            {/* Row 1: Board Labels */}
            <tr className="h-7 text-[10px] uppercase tracking-wider font-medium">
              <th colSpan={2} className="bg-gray-200 text-gray-600">
                Left Board
              </th>
              <th colSpan={2} className="bg-gray-200 text-gray-600">
                Right Board
              </th>
            </tr>
            {/* Row 2: Player Names */}
            <tr className="h-7 text-[8px] font-semibold">
              <th className="bg-white text-black px-1 w-1/4">
                {renderPlayerHeader(players.aWhite)}
              </th>
              <th className="bg-black text-white px-1 w-1/4">
                {renderPlayerHeader(players.aBlack)}
              </th>
              <th className="bg-white text-black px-1 w-1/4">
                {renderPlayerHeader(players.bWhite)}
              </th>
              <th className="bg-black text-white px-1 w-1/4">
                {renderPlayerHeader(players.bBlack)}
              </th>
            </tr>
          </thead>

          <tbody>
            {mainline.map((row) => {
              const move = row.node.incomingMove!;
              const isCursor = row.nodeId === cursorNodeId;
              const isSelected = row.nodeId === selectedNodeId;

              // 0: A White, 1: A Black, 2: B White, 3: B Black
              const colIndex =
                move.board === "A"
                  ? move.side === "white"
                    ? 0
                    : 1
                  : move.side === "white"
                    ? 2
                    : 3;

              const hasVariations = row.alternativeChildIds.length > 0;

              return (
                <React.Fragment key={row.nodeId}>
                  <tr
                    ref={isCursor ? setActiveElementRef(row.nodeId) : undefined}
                    onClick={() => onSelectNode(row.nodeId)}
                    className={[
                      "cursor-pointer transition-colors border-b border-gray-700/30",
                      isCursor
                        ? "bg-amber-200/15 hover:bg-amber-200/20"
                        : isSelected
                          ? "bg-gray-700/50 hover:bg-gray-700/60"
                          : "hover:bg-gray-700/50",
                    ].join(" ")}
                  >
                    {[0, 1, 2, 3].map((col) => {
                      let borderClass = "";
                      if (col === 0) borderClass = "border-r border-dashed border-gray-600/50";
                      else if (col === 1) borderClass = "border-r-4 border-gray-600/50";
                      else if (col === 2) borderClass = "border-r border-dashed border-gray-600/50";

                      return (
                        <td
                          key={col}
                          className={[
                            "relative p-1 text-center h-8 w-1/4",
                            col === colIndex
                              ? isCursor
                                ? "text-amber-200 font-bold"
                                : "text-gray-300"
                              : "",
                            borderClass,
                          ].join(" ")}
                        >
                          {col === colIndex ? (
                            <span className="block leading-4">{move.san}</span>
                          ) : (
                            ""
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {hasVariations && (
                    <tr className="border-b border-gray-700/30">
                      <td colSpan={4} className="p-2 bg-gray-900/40">
                        <div className="text-[12px] leading-6 text-gray-200">
                          {row.alternativeChildIds.map((childId) => (
                            <span key={`${row.nodeBeforeId}-${childId}`} className="mr-2">
                              {"("}
                              {renderVariationLine(childId)}
                              {")"}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {mainline.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-500 italic">
                  No moves yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

