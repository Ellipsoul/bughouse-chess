"use client";

import React from "react";
import type { BughousePromotionPiece } from "../types/analysis";

interface PromotionPickerProps {
  allowed: BughousePromotionPiece[];
  onPick: (piece: BughousePromotionPiece) => void;
  onCancel: () => void;
}

/**
 * Minimal promotion modal for analysis move entry.
 *
 * We purposely keep it small and keyboard-friendly:
 * - Click a piece to promote.
 * - Escape cancels (handled by parent key listener).
 */
export default function PromotionPicker({ allowed, onPick, onCancel }: PromotionPickerProps) {
  const pieceLabels: Record<BughousePromotionPiece, string> = {
    q: "Queen",
    r: "Rook",
    b: "Bishop",
    n: "Knight",
  };

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Choose promotion piece"
    >
      <div className="w-[340px] bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
        <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
          <div className="text-xs font-semibold text-gray-200 uppercase tracking-wide">
            Promotion
          </div>
          <button
            type="button"
            className="text-xs text-gray-300 hover:text-white"
            onClick={onCancel}
          >
            Esc
          </button>
        </div>

        <div className="p-3">
          <div className="text-sm text-gray-200 mb-3">
            Choose a piece to promote to:
          </div>
          <div className="grid grid-cols-2 gap-2">
            {allowed.map((p) => (
              <button
                key={p}
                type="button"
                className="px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700/70 text-sm"
                onClick={() => onPick(p)}
              >
                {pieceLabels[p]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

