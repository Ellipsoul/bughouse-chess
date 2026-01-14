"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";

type ReservePiece = "p" | "n" | "b" | "r" | "q";
type ReserveColor = "white" | "black";

interface PieceReserveVerticalProps {
  whiteReserves: { [piece: string]: number };
  blackReserves: { [piece: string]: number };
  bottomColor: "white" | "black";
  height?: number;
  /**
   * Visual density hint used for phone-landscape compatibility.
   * - `default`: current sizing (tablet/desktop)
   * - `compact`: smaller padding + smaller piece icons to avoid vertical overflow
   */
  density?: "default" | "compact";
  /**
   * When true, disables all interactivity (click + drag).
   *
   * This is used during live replay to ensure the reserves cannot be modified.
   */
  disabled?: boolean;
  /**
   * Optional click handler for interactive analysis mode.
   * When provided, reserve pieces become clickable to initiate drops.
   */
  onPieceClick?: (payload: { color: ReserveColor; piece: ReservePiece }) => void;
  /**
   * Optional selection marker (used to show the currently selected drop piece).
   */
  selected?: { color: ReserveColor; piece: ReservePiece } | null;
  /**
   * Optional drag-start handler for interactive analysis mode.
   * When provided, reserve pieces become draggable (when `count > 0`).
   */
  onPieceDragStart?: (payload: { color: ReserveColor; piece: ReservePiece }) => boolean | void;
  /**
   * Optional drag-end handler for interactive analysis mode.
   */
  onPieceDragEnd?: () => void;
}

/**
 * Computes the reserve-piece icon size (in px) based on the available reserve height.
 *
 * This is intentionally a small pure function so we can unit-test the sizing behavior.
 */
export function computeReservePiecePx(params: {
  height: number;
  density: "default" | "compact";
  /**
   * Optional reserve container width (in px).
   *
   * When provided, we also clamp piece size by width. This prevents horizontal overflow on
   * narrow reserve columns (common on small devices), since height-based sizing alone can
   * produce icons wider than the column.
   */
  width?: number;
}): number {
  const { height, density, width } = params;
  const isCompact = density === "compact";

  const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));
  const slotHeightPx = height / 10;

  // Keep the pieces comfortably inside each slot and prevent reserves from overflowing on short viewports.
  const heightDrivenPx = Math.floor(slotHeightPx - (isCompact ? 6 : 10));

  // Reserve uses `px-0.5` (compact) or `px-1` (default), so subtract a small fixed budget for
  // horizontal padding and leave a couple extra pixels for safety.
  const widthDrivenPx =
    typeof width === "number" && Number.isFinite(width)
      ? Math.floor(width - (isCompact ? 6 : 10))
      : Number.POSITIVE_INFINITY;

  return clamp(18, Math.min(heightDrivenPx, widthDrivenPx), isCompact ? 30 : 40);
}

/**
 * Displays captured-piece reserves for one board in a vertical strip.
 * Ordering mirrors over-the-board intuition: the bottom player sees their pawns closest.
 */
const PieceReserveVertical: React.FC<PieceReserveVerticalProps> = ({
  whiteReserves,
  blackReserves,
  bottomColor,
  height = 400,
  density = "default",
  disabled = false,
  onPieceClick,
  selected = null,
  onPieceDragStart,
  onPieceDragEnd,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidthPx, setContainerWidthPx] = useState<number | null>(null);

  const pieceOrder: ReservePiece[] = ["p", "n", "b", "r", "q"];
  const isWhiteBottom = bottomColor === "white";

  const topColor: ReserveColor = isWhiteBottom ? "black" : "white";

  const topPieces = [...pieceOrder]; // [p, n, b, r, q] -> Displayed top to bottom (P at top)
  const bottomPieces = [...pieceOrder].reverse(); // [q, r, b, n, p] -> Displayed top to bottom (Q at top, P at bottom)

  // Construct the full list of 10 slots
  // We need to store: piece type, color, count
  type Slot = { piece: ReservePiece; color: ReserveColor; count: number };

  const slots: Slot[] = [];

  // Top Half
  topPieces.forEach((p) => {
    slots.push({
      piece: p,
      color: topColor,
      count: (topColor === "white" ? whiteReserves : blackReserves)[p] || 0,
    });
  });

  // Bottom Half
  bottomPieces.forEach((p) => {
    slots.push({
      piece: p,
      color: bottomColor,
      count: (bottomColor === "white" ? whiteReserves : blackReserves)[p] || 0,
    });
  });

  const getPieceImage = (piece: ReservePiece, color: ReserveColor) => {
    const code = color === "white" ? `w${piece.toUpperCase()}` : `b${piece.toUpperCase()}`;
    return `https://chessboardjs.com/img/chesspieces/wikipedia/${code}.png`;
  };

  const isCompact = density === "compact";
  const piecePx = computeReservePiecePx({ height, density, width: containerWidthPx ?? undefined });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const next = Math.floor(el.clientWidth);
      setContainerWidthPx((prev) => (prev === next ? prev : next));
    };

    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={[
        "grid grid-rows-10 bg-gray-800 rounded-lg w-full overflow-hidden",
        // Keep vertical breathing room, but reduce horizontal padding so reserves can shrink on narrow screens.
        isCompact ? "py-1 px-0.5" : "py-2 px-1",
      ].join(" ")}
      style={{ height: `${height}px` }}
    >
      {slots.map((slot, index) => (
        <div
          key={`${slot.color}-${slot.piece}-${index}`}
          className={[
            "relative flex items-center justify-center rounded",
            slot.count > 0 ? "opacity-100" : "opacity-30",
            !disabled && onPieceClick && slot.count > 0 ? "cursor-pointer hover:bg-gray-700/50" : "",
            selected?.color === slot.color && selected?.piece === slot.piece
              ? "ring-2 ring-amber-200/60 bg-gray-700/40"
              : "",
          ].join(" ")}
          role={!disabled && onPieceClick && slot.count > 0 ? "button" : undefined}
          tabIndex={!disabled && onPieceClick && slot.count > 0 ? 0 : undefined}
          aria-label={
            !disabled && onPieceClick && slot.count > 0
              ? `Select ${slot.color} ${slot.piece.toUpperCase()} to drop`
              : undefined
          }
          draggable={!disabled && Boolean(onPieceDragStart) && slot.count > 0}
          onDragStart={(e) => {
            if (disabled) return;
            if (!onPieceDragStart || slot.count <= 0) return;
            const ok = onPieceDragStart({ color: slot.color, piece: slot.piece });
            if (ok === false) {
              e.preventDefault();
              return;
            }
            // Provide a stable payload for board drop handlers.
            e.dataTransfer.setData(
              "application/x-bughouse-reserve-piece",
              JSON.stringify({ color: slot.color, piece: slot.piece }),
            );
            // Use "move" to avoid the OS showing a "copy (+)" badge on the drag ghost.
            // Semantically we still validate + decrement reserves only on successful drop.
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => {
            if (disabled) return;
            onPieceDragEnd?.();
          }}
          onClick={() => {
            if (disabled) return;
            if (!onPieceClick || slot.count <= 0) return;
            onPieceClick({ color: slot.color, piece: slot.piece });
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (!onPieceClick || slot.count <= 0) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onPieceClick({ color: slot.color, piece: slot.piece });
            }
          }}
        >
          <Image
            src={getPieceImage(slot.piece, slot.color)}
            alt={`${slot.color} ${slot.piece}`}
            width={80}
            height={80}
            className="object-contain shrink-0"
            style={{ width: piecePx, height: piecePx }}
            priority
          />

          {slot.count > 0 && (
            <span
              className={[
                "absolute -bottom-1 -right-1 bg-cyan-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold z-10",
                isCompact ? "w-3.5 h-3.5 text-[9px]" : "w-4 h-4 text-[10px]",
              ].join(" ")}
            >
              {slot.count}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

export default PieceReserveVertical;
