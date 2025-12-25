"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BughouseMove, BughousePlayer } from "../types/bughouse";
import type { AnalysisNode, AnalysisTree } from "../types/analysis";
import { findContainingVariationHeadNodeId } from "../utils/analysis/findVariationHead";

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
  /**
   * Combined moves from the loaded game, used to calculate and display move times.
   * If not provided, move times will not be displayed.
   */
  combinedMoves?: BughouseMove[];
  /**
   * Optional per-move durations (deciseconds), aligned with `combinedMoves` indices.
   *
   * These durations are intended to represent **per-board move times**: the elapsed time since
   * the previous move on the same board as the move being displayed.
   */
  combinedMoveDurations?: number[];
  /**
   * Optional footer rendered *below* the scrollable move list (e.g. game metadata).
   */
  footer?: React.ReactNode;
  /**
   * When true, disables all move-list interactions (selecting nodes, context menus, keyboard
   * activation). Scrolling remains enabled.
   *
   * This is used during live replay to prevent navigation from interrupting playback.
   */
  disabled?: boolean;
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

type MainlineRow = {
  nodeId: string;
  nodeBeforeId: string;
  node: AnalysisNode;
  alternativeChildIds: string[];
  /**
   * Board-local ply index (1-indexed) for this move on its board.
   * Example: white's first move on board A => 1, black's first move on A => 2.
   */
  plyOnBoard: number;
  /**
   * UI label shown in the left-side “drawer” column.
   * - White:  `A1`, `B3`
   * - Black:  `...A1`, `...B9`
   */
  moveNumberLabel: string;
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
  combinedMoves,
  combinedMoveDurations,
  footer,
  disabled = false,
  onSelectNode,
  onPromoteVariationOneLevel,
  onTruncateAfterNode,
  onTruncateFromNodeInclusive,
}: MoveListWithVariationsProps) {
  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const canPromoteNode = useCallback(
    (nodeId: string) => {
      const headId = findContainingVariationHeadNodeId(tree.nodesById, nodeId);
      if (!headId) return false;

      const head = tree.nodesById[headId];
      if (!head?.parentId) return false;
      const parent = tree.nodesById[head.parentId];
      if (!parent) return false;
      return parent.mainChildId !== headId;
    },
    [tree.nodesById],
  );

  const canTruncateNode = useCallback(
    (nodeId: string) => {
      if (nodeId === tree.rootId) return false;
      const node = tree.nodesById[nodeId];
      return Boolean(node && node.children.length > 0);
    },
    [tree.nodesById, tree.rootId],
  );

  const canTruncateNodeInclusive = useCallback(
    (nodeId: string) => {
      if (nodeId === tree.rootId) return false;
      return Boolean(tree.nodesById[nodeId]);
    },
    [tree.nodesById, tree.rootId],
  );

  const mainline = useMemo<MainlineRow[]>(() => {
    const rows: MainlineRow[] = [];
    let nodeId = tree.rootId;
    let plyA = 0;
    let plyB = 0;

    while (true) {
      const nodeBefore = tree.nodesById[nodeId];
      if (!nodeBefore?.mainChildId) break;
      const childId = nodeBefore.mainChildId;
      const child = tree.nodesById[childId];
      if (!child?.incomingMove) break;

      const board = child.incomingMove.board;
      const side = child.incomingMove.side;
      const nextPlyOnBoard = board === "A" ? (plyA += 1) : (plyB += 1);
      const fullmoveNumber = Math.floor((nextPlyOnBoard - 1) / 2) + 1;
      const moveNumberLabel =
        side === "white"
          ? `${board}${fullmoveNumber}`
          : `${board}${fullmoveNumber}'`;

      rows.push({
        nodeId: childId,
        nodeBeforeId: nodeId,
        node: child,
        alternativeChildIds: nodeBefore.children.filter((id) => id !== childId),
        plyOnBoard: nextPlyOnBoard,
        moveNumberLabel,
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

  /**
   * Calculate move durations for mainline nodes by matching them to combinedMoves.
   * Returns a map from nodeId to duration in deciseconds, or undefined if no timestamp data.
   */
  const mainlineMoveDurations = useMemo(() => {
    if (!combinedMoves || combinedMoves.length === 0) return undefined;
    if (!combinedMoveDurations) return undefined;

    const durations = new Map<string, number>();
    let combinedMoveIndex = 0;

    // Walk through mainline and match nodes to combinedMoves
    let nodeId = tree.rootId;
    while (true) {
      const nodeBefore = tree.nodesById[nodeId];
      if (!nodeBefore?.mainChildId) break;
      const childId = nodeBefore.mainChildId;
      const child = tree.nodesById[childId];
      if (!child?.incomingMove) break;

      const move = child.incomingMove;

      // Try to find matching move in combinedMoves
      // We match by board, side, and SAN (move notation)
      let matched = false;
      for (let i = combinedMoveIndex; i < combinedMoves.length; i++) {
        const combinedMove = combinedMoves[i];
        if (
          combinedMove.board === move.board &&
          combinedMove.side === move.side &&
          combinedMove.move === move.san
        ) {
          const duration = combinedMoveDurations[i];
          if (Number.isFinite(duration)) {
            durations.set(childId, Math.max(0, duration));
          }
          combinedMoveIndex = i + 1;
          matched = true;
          break;
        }
      }

      // If no match found, this is likely a user-added move, so no timestamp
      if (!matched) {
        // No duration available for user-added moves.
      }

      nodeId = childId;
    }

    return durations;
  }, [combinedMoveDurations, combinedMoves, tree.nodesById, tree.rootId]);

  /**
   * Format move time duration for display.
   * @param deciseconds - Duration in deciseconds (tenths of seconds)
   * @returns Formatted string like "1.2s" or "1:23.4"
   */
  const formatMoveTime = useCallback((deciseconds?: number) => {
    if (!Number.isFinite(deciseconds)) return "—";

    const safeValue = Math.max(0, Math.round(deciseconds ?? 0));
    const minutes = Math.floor(safeValue / 600);
    const seconds = Math.floor((safeValue % 600) / 10);
    const tenths = safeValue % 10;

    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
    }

    return `${(safeValue / 10).toFixed(1)}s`;
  }, []);

  const formatMoveListPlayerName = useCallback((username: string) => {
    // The board UI uses "(A)/(B)" placeholders for the initial empty analysis state.
    // In the move list header, board ownership is already implied by the 4 columns,
    // so these suffixes add noise.
    return username.replace(/\s+\([AB]\)\s*$/, "");
  }, []);

  const renderPlayerHeader = useCallback((player: BughousePlayer) => {
    return (
      <div className="flex items-center justify-center gap-1 min-w-0">
        <span className="truncate min-w-0" title={formatMoveListPlayerName(player.username)}>
          {formatMoveListPlayerName(player.username)}
        </span>
      </div>
    );
  }, [formatMoveListPlayerName]);

  const renderMoveToken = useCallback(
    (
      nodeId: string,
      options: {
        /**
         * Overrides the left mini-label inside the token (default is the board letter).
         * Pass `null` to hide it entirely.
         */
        leadingLabel?: string | null;
      } = {},
    ) => {
      const node = tree.nodesById[nodeId];
      const move = node?.incomingMove;
      if (!node || !move) return null;

      const isSelected = nodeId === selectedNodeId;
      const isCursor = nodeId === cursorNodeId;
      const leadingLabel = Object.prototype.hasOwnProperty.call(options, "leadingLabel")
        ? options.leadingLabel
        : move.board;

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
          onClick={() => {
            if (disabled) return;
            onSelectNode(nodeId);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (disabled) return;
            onSelectNode(nodeId);
            setContextMenu({
              open: true,
              nodeId,
              x: e.clientX,
              y: e.clientY,
            });
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectNode(nodeId);
            }
          }}
          title={`${move.board} ${move.san}`}
        >
          {leadingLabel ? (
            <span className="text-[10px] font-bold text-gray-400">{leadingLabel}</span>
          ) : null}
          <span className="leading-5">{move.san}</span>
        </span>
      );
    },
    [cursorNodeId, disabled, onSelectNode, selectedNodeId, setActiveElementRef, tree.nodesById],
  );

  /**
   * Compute the 1-indexed ply count on a given board for a node by walking parents.
   *
   * This is only used for move-number prefixes in variation text blocks, so we keep it
   * simple and memoize per-render via a Map.
   */
  const plyCountCacheRef = useRef<Map<string, { A: number; B: number }>>(new Map());
  useEffect(() => {
    plyCountCacheRef.current = new Map();
  }, [tree.nodesById]);

  const getBoardPlyCountsAtNode = useCallback(
    (nodeId: string): { A: number; B: number } => {
      const cache = plyCountCacheRef.current;
      const cached = cache.get(nodeId);
      if (cached) return cached;

      // Walk up until we hit a cached ancestor (or the root), then backfill.
      const path: string[] = [];
      let cursorId: string | null = nodeId;
      let base: { A: number; B: number } = { A: 0, B: 0 };

      while (cursorId) {
        const hit = cache.get(cursorId);
        if (hit) {
          base = hit;
          break;
        }
        const currentNode: AnalysisNode | undefined = tree.nodesById[cursorId as string];
        if (!currentNode || !currentNode.parentId) {
          base = { A: 0, B: 0 };
          break;
        }
        path.push(cursorId);
        cursorId = currentNode.parentId;
      }

      let counts = base;
      for (let i = path.length - 1; i >= 0; i -= 1) {
        const id = path[i];
        const currentNode: AnalysisNode | undefined = tree.nodesById[id];
        const mv = currentNode?.incomingMove;
        counts = {
          A: counts.A + (mv?.board === "A" ? 1 : 0),
          B: counts.B + (mv?.board === "B" ? 1 : 0),
        };
        cache.set(id, counts);
      }

      cache.set(nodeId, cache.get(nodeId) ?? counts);
      return cache.get(nodeId) ?? counts;
    },
    [tree.nodesById],
  );

  const getMoveNumberLabelForNode = useCallback(
    (nodeId: string): { board: "A" | "B"; side: "white" | "black"; plyOnBoard: number; label: string } | null => {
      const node = tree.nodesById[nodeId];
      const mv = node?.incomingMove;
      if (!node || !mv) return null;
      const counts = getBoardPlyCountsAtNode(nodeId);
      const plyOnBoard = mv.board === "A" ? counts.A : counts.B;
      const fullmoveNumber = Math.floor((plyOnBoard - 1) / 2) + 1;
      // For variation text blocks we prefer traditional PGN-like numbering for black moves.
      // (The mainline gutter uses a different style.)
      const label =
        mv.side === "white" ? `${mv.board}${fullmoveNumber}` : `...${mv.board}${fullmoveNumber}`;
      return { board: mv.board, side: mv.side, plyOnBoard, label };
    },
    [getBoardPlyCountsAtNode, tree.nodesById],
  );

  const getVariationTokenLeadingLabel = useCallback(
    (nodeId: string, opts: { showNumber: boolean }) => {
      if (!opts.showNumber) return null;
      return getMoveNumberLabelForNode(nodeId)?.label ?? null;
    },
    [getMoveNumberLabelForNode],
  );

  const MAX_STRUCTURED_VARIATION_DEPTH = 3;

  /**
   * Inline (single-line) variation renderer used as a fallback when nesting depth is too large.
   * This mirrors the previous behavior: all nested sub-variations appear as parenthesized
   * inline blocks rather than separate lines.
   */
  const renderVariationInline = useCallback(
    function renderVariationInline(startNodeId: string): React.ReactNode {
      const startNode = tree.nodesById[startNodeId];
      if (!startNode) return null;

      const tokens: React.ReactNode[] = [];
      let node: AnalysisNode | undefined = startNode;
      let prevNumberInfo: ReturnType<typeof getMoveNumberLabelForNode> = null;

      while (node) {
        const current: AnalysisNode = node;

        const currentInfo = getMoveNumberLabelForNode(current.id);
        const shouldHideBlackNumber =
          Boolean(prevNumberInfo && currentInfo) &&
          currentInfo?.side === "black" &&
          prevNumberInfo?.side === "white" &&
          currentInfo.board === prevNumberInfo.board &&
          currentInfo.plyOnBoard === prevNumberInfo.plyOnBoard + 1;

        const showNumber = !shouldHideBlackNumber;
        tokens.push(
          renderMoveToken(current.id, {
            leadingLabel: getVariationTokenLeadingLabel(current.id, { showNumber }),
          }),
        );
        prevNumberInfo = currentInfo;

        const nonMainChildren = current.children.filter(
          (id: string) => id !== current.mainChildId,
        );
        if (nonMainChildren.length > 0) {
          tokens.push(
            <span key={`${current.id}-inline-nested`} className="text-gray-300">
              {" "}
              {nonMainChildren.map((childId: string) => (
                <span key={`${current.id}-${childId}`} className="inline">
                  <span className="text-gray-400">(</span>
                  {renderVariationInline(childId)}
                  <span className="text-gray-400">)</span>{" "}
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
    [getMoveNumberLabelForNode, getVariationTokenLeadingLabel, renderMoveToken, tree.nodesById],
  );

  /**
   * Render a single variation as:
   * - One mainline sequence on a single line (wrapped in parentheses)
   * - Any nested sub-variations on their own lines, indented
   */
  const renderVariationBlock = useCallback(
    function renderVariationBlock(startNodeId: string, depth: number): React.ReactNode {
      const startNode = tree.nodesById[startNodeId];
      if (!startNode) return null;

      // Prevent runaway indentation/width growth: after a few levels, fall back to
      // the previous inline representation (single “text area” style).
      if (depth >= MAX_STRUCTURED_VARIATION_DEPTH) {
        return (
          <div
            key={`${startNodeId}-var-inline-${depth}`}
            style={{ paddingLeft: MAX_STRUCTURED_VARIATION_DEPTH * 12 }}
            className="text-[12px] leading-6 text-gray-200"
          >
            <div className="whitespace-normal">
              <span className="text-gray-400">(</span>
              {renderVariationInline(startNodeId)}
              <span className="text-gray-400">)</span>
            </div>
          </div>
        );
      }

      const lineTokens: React.ReactNode[] = [];
      const nested: React.ReactNode[] = [];

      let node: AnalysisNode | undefined = startNode;
      let prevNumberInfo: ReturnType<typeof getMoveNumberLabelForNode> = null;

      while (node) {
        const current: AnalysisNode = node;

        const currentInfo = getMoveNumberLabelForNode(current.id);
        const shouldHideBlackNumber =
          Boolean(prevNumberInfo && currentInfo) &&
          currentInfo?.side === "black" &&
          prevNumberInfo?.side === "white" &&
          currentInfo.board === prevNumberInfo.board &&
          currentInfo.plyOnBoard === prevNumberInfo.plyOnBoard + 1;

        const showNumber = !shouldHideBlackNumber;
        lineTokens.push(
          renderMoveToken(current.id, {
            // Replace the existing board label with the move-number label (or hide it).
            leadingLabel: getVariationTokenLeadingLabel(current.id, { showNumber }),
          }),
        );
        prevNumberInfo = currentInfo;

        const nonMainChildren = current.children.filter((id: string) => id !== current.mainChildId);

        /**
         * Important indentation invariant:
         *
         * When we hit a branching node, we want *all* continuations (the "main" continuation
         * and the alternative ones) to render at the same indentation level under the
         * branching move. Otherwise, a later branch inside the main continuation can end
         * up with the same indentation as an earlier sibling continuation, which makes
         * the tree visually ambiguous.
         *
         * So: once we encounter any alternatives at `current`, we stop extending the
         * current single-line sequence and instead render *every* continuation as a
         * nested variation block.
         */
        if (nonMainChildren.length > 0) {
          const continuationIds = [
            // Include the "main" continuation first so it stays visually primary.
            current.mainChildId,
            ...nonMainChildren,
          ].filter((id): id is string => typeof id === "string" && id.length > 0);

          for (const childId of continuationIds) {
            nested.push(renderVariationBlock(childId, depth + 1));
          }

          // Stop the current line at the branching move; continuations render below.
          break;
        }

        const nextId: string | null = current.mainChildId;
        node = nextId ? tree.nodesById[nextId] : undefined;
        if (node) {
          lineTokens.push(
            <span key={`${node.id}-sp`} className="text-gray-500">
              {" "}
            </span>,
          );
        }
      }

      return (
        <div
          key={`${startNodeId}-var-${depth}`}
          style={{ paddingLeft: depth * 12 }}
          className="text-[12px] leading-6 text-gray-200"
        >
          <div className="whitespace-normal">
            <span className="text-gray-400">(</span>
            {lineTokens}
            <span className="text-gray-400">)</span>
          </div>
          {nested.length > 0 ? (
            <div className="mt-1 flex flex-col gap-1">{nested}</div>
          ) : null}
        </div>
      );
    },
    [
      getMoveNumberLabelForNode,
      getVariationTokenLeadingLabel,
      renderMoveToken,
      renderVariationInline,
      tree.nodesById,
    ],
  );

  // Close context menu on outside click / Escape.
  useEffect(() => {
    if (!contextMenu?.open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) {
        closeContextMenu();
        return;
      }
      // If the user clicked on the menu itself, keep it open.
      if (target.closest("[data-bh-context-menu='true']")) return;
      closeContextMenu();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeContextMenu();
    };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeContextMenu, contextMenu?.open]);

  const menu = contextMenu?.open ? contextMenu : null;
  const menuCanPromote = menu ? canPromoteNode(menu.nodeId) : false;
  const menuCanTruncate = menu ? canTruncateNode(menu.nodeId) : false;
  const menuCanTruncateInclusive = menu ? canTruncateNodeInclusive(menu.nodeId) : false;

  // Basic viewport clamping so the menu doesn't render off-screen.
  const menuPosition = useMemo(() => {
    if (!menu) return null;
    const width = 210;
    const height = 136;
    const margin = 8;
    const safeWindow =
      typeof window !== "undefined" ? window : { innerWidth: 1200, innerHeight: 800 };
    const x = Math.min(menu.x, Math.max(margin, safeWindow.innerWidth - width - margin));
    const y = Math.min(menu.y, Math.max(margin, safeWindow.innerHeight - height - margin));
    return { x, y, width };
  }, [menu]);

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg overflow-hidden border border-gray-700 w-full">
      <div
        ref={containerRef}
        className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 relative"
        onContextMenu={(e) => {
          // Disable default context menu inside the move list.
          e.preventDefault();
        }}
      >
        {menu && menuPosition && (
          <div
            data-bh-context-menu="true"
            className="fixed z-50 bg-gray-900 border border-gray-700 rounded-md shadow-xl overflow-hidden"
            style={{ left: menuPosition.x, top: menuPosition.y, width: menuPosition.width }}
            role="menu"
            aria-label="Move actions"
          >
            <button
              type="button"
              className={[
                "w-full text-left px-3 py-2 text-sm border-b border-gray-800",
                menuCanTruncate ? "text-gray-200 hover:bg-gray-800/70" : "text-gray-600 cursor-not-allowed",
              ].join(" ")}
              disabled={!menuCanTruncate}
              onClick={() => {
                onTruncateAfterNode(menu.nodeId);
                closeContextMenu();
              }}
            >
              Delete after here (keep this move)
            </button>
            <button
              type="button"
              className={[
                "w-full text-left px-3 py-2 text-sm border-b border-gray-800",
                menuCanTruncateInclusive ? "text-gray-200 hover:bg-gray-800/70" : "text-gray-600 cursor-not-allowed",
              ].join(" ")}
              disabled={!menuCanTruncateInclusive}
              onClick={() => {
                onTruncateFromNodeInclusive(menu.nodeId);
                closeContextMenu();
              }}
            >
              Delete from here (including this move)
            </button>
            <button
              type="button"
              className={[
                "w-full text-left px-3 py-2 text-sm",
                menuCanPromote ? "text-gray-200 hover:bg-gray-800/70" : "text-gray-600 cursor-not-allowed",
              ].join(" ")}
              disabled={!menuCanPromote}
              onClick={() => {
                onPromoteVariationOneLevel(menu.nodeId);
                closeContextMenu();
              }}
            >
              Promote variation
            </button>
          </div>
        )}

        <table className="w-full text-sm border-collapse table-fixed">
          <colgroup>
            <col className="w-10" />
            <col className="w-[calc((100%-2.5rem)/4)]" />
            <col className="w-[calc((100%-2.5rem)/4)]" />
            <col className="w-[calc((100%-2.5rem)/4)]" />
            <col className="w-[calc((100%-2.5rem)/4)]" />
          </colgroup>
          <thead ref={headerRef} className="sticky top-0 z-10 shadow-md">
            {/* Row 1: Board Labels */}
            <tr className="h-7 text-[10px] uppercase tracking-wider font-medium">
              <th className="bg-gray-200 text-gray-600 w-10" />
              <th colSpan={2} className="bg-gray-200 text-gray-600">
                Left Board
              </th>
              <th colSpan={2} className="bg-gray-200 text-gray-600">
                Right Board
              </th>
            </tr>
            {/* Row 2: Player Names */}
            <tr className="h-7 text-[8px] font-semibold">
              <th className="bg-gray-200 text-gray-600 px-1 w-10" />
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
                    onClick={() => {
                      if (disabled) return;
                      onSelectNode(row.nodeId);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (disabled) return;
                      onSelectNode(row.nodeId);
                      setContextMenu({
                        open: true,
                        nodeId: row.nodeId,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                    className={[
                      "cursor-pointer transition-colors border-b border-gray-700/30",
                      isCursor
                        ? "bg-amber-200/15 hover:bg-amber-200/20"
                        : isSelected
                          ? "bg-gray-700/50 hover:bg-gray-700/60"
                          : "hover:bg-gray-700/50",
                    ].join(" ")}
                  >
                    {/* Move-number “drawer” column */}
                    <td
                      className={[
                        "p-1 text-center align-middle bg-gray-900/35 text-[10px] font-mono text-gray-400",
                        "border-r border-gray-700/40",
                      ].join(" ")}
                      title={`Move number on board ${move.board}`}
                    >
                      {row.moveNumberLabel}
                    </td>

                    {[0, 1, 2, 3].map((col) => {
                      let borderClass = "";
                      if (col === 0) borderClass = "border-r border-dashed border-gray-600/50";
                      else if (col === 1) borderClass = "border-r-4 border-gray-600/50";
                      else if (col === 2) borderClass = "border-r border-dashed border-gray-600/50";

                      const moveDuration =
                        mainlineMoveDurations?.get(row.nodeId);
                      return (
                        <td
                          key={col}
                          className={[
                            "relative p-1 text-center h-8",
                            col === colIndex
                              ? isCursor
                                ? "text-amber-200 font-bold"
                                : "text-gray-300"
                              : "",
                            borderClass,
                          ].join(" ")}
                        >
                          {col === colIndex ? (
                            <>
                              <span className="block leading-4">{move.san}</span>
                              {mainlineMoveDurations !== undefined && (
                                <span
                                  className="absolute bottom-0.5 right-1 text-[9px] text-gray-400 font-mono leading-none"
                                  title={`Time since previous move on this board: ${formatMoveTime(moveDuration)}`}
                                >
                                  {formatMoveTime(moveDuration)}
                                </span>
                              )}
                            </>
                          ) : (
                            ""
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {hasVariations && (
                    <tr className="border-b border-gray-700/30">
                      <td className="p-1 bg-gray-900/35 border-r border-gray-700/40" />
                      <td colSpan={4} className="p-2 bg-gray-900/40">
                        <div className="flex flex-col gap-1">
                          {row.alternativeChildIds.map((childId) =>
                            renderVariationBlock(childId, 0),
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {mainline.length === 0 && (
              <tr>
                <td className="p-1 bg-gray-900/35 border-r border-gray-700/40" />
                <td colSpan={4} className="p-4 text-center text-gray-500 italic">
                  No moves yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-gray-700 bg-gray-900/25">{footer}</div>
      ) : null}
    </div>
  );
}

