"use client";

import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";
import type { BughousePromotionPiece } from "../types/analysis";
import { APP_TOOLTIP_ID } from "../utils/tooltips";
import type { BughouseBoardId } from "../types/analysis";
import type { Square } from "chess.js";

interface PromotionPickerProps {
  board: BughouseBoardId;
  /**
   * The square the pawn attempted to promote on.
   * Used to anchor the picker UI over the board.
   */
  to: Square;
  /**
   * Color of the promoting side (drives which piece images we render).
   */
  side: "white" | "black";
  allowed: BughousePromotionPiece[];
  onPick: (piece: BughousePromotionPiece) => void;
  onCancel: () => void;
}

/**
 * Chess.com-inspired promotion picker:
 * - Small, square-anchored UI rendered over the promotion square.
 * - Queen sits on the promotion square so the user can click again without moving the mouse.
 *
 * Notes:
 * - Escape cancels (handled by parent key listener).
 * - We intentionally use `position: fixed` and measure the square's bounding box so the
 *   picker stays correctly positioned even if the board container changes layout.
 */
export default function PromotionPicker({ board, to, side, allowed, onPick, onCancel }: PromotionPickerProps) {
  const pieceLabels: Record<BughousePromotionPiece, string> = {
    q: "Queen",
    r: "Rook",
    b: "Bishop",
    n: "Knight",
  };

  const boardElementId = useMemo(() => `board-${board}`, [board]);

  const [anchor, setAnchor] = useState<{
    left: number;
    top: number;
    size: number;
    stackDown: boolean;
  } | null>(null);

  const orderedAllowed = useMemo(() => {
    const base: BughousePromotionPiece[] = ["q", "n", "r", "b"];
    const filtered = base.filter((p) => allowed.includes(p));
    return filtered.length ? filtered : allowed;
  }, [allowed]);

  useEffect(() => {
    const computeAnchor = () => {
      const boardEl = document.getElementById(boardElementId);
      if (!boardEl) {
        setAnchor(null);
        return;
      }
      const squareEl = boardEl.querySelector(`[data-square="${to}"]`);
      if (!(squareEl instanceof HTMLElement)) {
        setAnchor(null);
        return;
      }

      const squareRect = squareEl.getBoundingClientRect();
      const boardRect = boardEl.getBoundingClientRect();
      const size = Math.max(1, squareRect.width);
      const squareCenterY = squareRect.top + squareRect.height / 2;
      const boardCenterY = boardRect.top + boardRect.height / 2;
      const stackDown = squareCenterY < boardCenterY;

      setAnchor({
        left: squareRect.left,
        top: squareRect.top,
        size,
        stackDown,
      });
    };

    computeAnchor();
    window.addEventListener("resize", computeAnchor);
    window.addEventListener("scroll", computeAnchor, true);
    return () => {
      window.removeEventListener("resize", computeAnchor);
      window.removeEventListener("scroll", computeAnchor, true);
    };
  }, [boardElementId, to]);

  if (!anchor) {
    // If we cannot find the anchor square in the DOM, fail gracefully with a tiny fallback.
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center">
        <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Promotion</div>
            <button
              type="button"
              className="text-xs text-gray-300 hover:text-white"
              onClick={onCancel}
              data-tooltip-id={APP_TOOLTIP_ID}
              data-tooltip-content="Cancel promotion (Esc)"
            >
              Esc
            </button>
          </div>
          <div className="flex gap-2">
            {orderedAllowed.map((p) => (
              <button
                key={p}
                type="button"
                className="px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700/70 text-sm"
                onClick={() => onPick(p)}
                data-tooltip-id={APP_TOOLTIP_ID}
                data-tooltip-content={`Promote to ${pieceLabels[p]}`}
              >
                {pieceLabels[p]}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const pieceImgCode = (p: BughousePromotionPiece) => {
    const color = side === "white" ? "w" : "b";
    const letter: Record<BughousePromotionPiece, string> = { q: "Q", r: "R", b: "B", n: "N" };
    return `${color}${letter[p]}`;
  };

  const pieceImgUrl = (p: BughousePromotionPiece) =>
    `https://chessboardjs.com/img/chesspieces/wikipedia/${pieceImgCode(p)}.png`;

  const stackPieces = anchor.stackDown ? orderedAllowed : [...orderedAllowed].reverse();
  const count = stackPieces.length;
  const containerTop = anchor.stackDown ? anchor.top : anchor.top - (count - 1) * anchor.size;

  return (
    <div
      className="fixed z-40"
      style={{
        left: anchor.left,
        top: containerTop,
        width: anchor.size,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Choose promotion piece"
    >
      <div className="rounded-md overflow-hidden shadow-xl border border-gray-700 bg-gray-900/95">
        {stackPieces.map((p) => (
          <button
            key={p}
            type="button"
            className="relative flex items-center justify-center hover:bg-gray-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60"
            style={{ width: anchor.size, height: anchor.size }}
            onClick={() => onPick(p)}
            data-tooltip-id={APP_TOOLTIP_ID}
            data-tooltip-content={`Promote to ${pieceLabels[p]}`}
          >
            <Image
              src={pieceImgUrl(p)}
              alt={pieceLabels[p]}
              draggable={false}
              width={Math.round(anchor.size * 0.86)}
              height={Math.round(anchor.size * 0.86)}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
