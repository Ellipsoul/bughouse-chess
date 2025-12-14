"use client";

import React from "react";
import type { AnalysisTree } from "../types/analysis";
import type { VariationSelectorState } from "./useAnalysisState";
import { APP_TOOLTIP_ID } from "../utils/tooltips";

interface VariationSelectorProps {
  tree: AnalysisTree;
  selector: VariationSelectorState;
  onSelectIndex: (index: number) => void;
  onAccept: () => void;
  onCancel: () => void;
}

/**
 * Small branch selection dialog shown when the current position has multiple
 * possible continuations.
 *
 * Keyboard semantics (handled by parent):
 * - Up/Down: change selection
 * - Right/Enter: accept + advance
 * - Left/Escape: cancel
 */
export default function VariationSelector({
  tree,
  selector,
  onSelectIndex,
  onAccept,
  onCancel,
}: VariationSelectorProps) {
  const node = tree.nodesById[selector.nodeId];
  if (!node) return null;

  const children = node.children
    .map((id) => tree.nodesById[id])
    .filter(Boolean);

  if (children.length <= 1) return null;

  return (
    <div
      className="absolute z-20 right-4 top-4 w-[320px] bg-gray-900/95 border border-gray-700 rounded-lg shadow-xl backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label="Variation selector"
    >
      <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
        <div className="text-xs font-semibold text-gray-200 uppercase tracking-wide">
          Choose variation
        </div>
        <button
          type="button"
          className="text-xs text-gray-300 hover:text-white"
          onClick={onCancel}
          data-tooltip-id={APP_TOOLTIP_ID}
          data-tooltip-content="Cancel (Esc)"
        >
          Esc
        </button>
      </div>

      <div className="p-2">
        <ul className="flex flex-col gap-1">
          {children.map((child, idx) => {
            const mv = child.incomingMove;
            const isActive = idx === selector.selectedChildIndex;
            return (
              <li key={child.id}>
                <button
                  type="button"
                  className={
                    "w-full text-left px-2 py-2 rounded border transition-colors " +
                    (isActive
                      ? "bg-amber-200/15 border-amber-200/30 text-amber-200"
                      : "bg-gray-800/40 border-gray-700 text-gray-200 hover:bg-gray-800/70")
                  }
                  onClick={() => onSelectIndex(idx)}
                  onDoubleClick={onAccept}
                  data-tooltip-id={APP_TOOLTIP_ID}
                  data-tooltip-content={
                    mv
                      ? `Select ${mv.board} ${mv.san} (double-click to accept)`
                      : "Select move"
                  }
                >
                  {mv ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400">
                        {mv.board}
                      </span>
                      <span className="font-semibold">{mv.san}</span>
                      <span className="ml-auto text-[10px] text-gray-400">
                        {mv.side === "white" ? "White" : "Black"}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">Unknown move</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            className="px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700"
            onClick={onCancel}
            data-tooltip-id={APP_TOOLTIP_ID}
            data-tooltip-content="Cancel (Esc)"
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-2 py-1 text-xs rounded bg-mariner-600 border border-mariner-400 text-white hover:bg-mariner-500"
            onClick={onAccept}
            data-tooltip-id={APP_TOOLTIP_ID}
            data-tooltip-content="Accept and advance (Enter)"
          >
            Enter
          </button>
        </div>
      </div>
    </div>
  );
}

