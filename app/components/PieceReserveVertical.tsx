import React from "react";
import Image from "next/image";

type ReservePiece = "p" | "n" | "b" | "r" | "q";
type ReserveColor = "white" | "black";

interface PieceReserveVerticalProps {
  whiteReserves: { [piece: string]: number };
  blackReserves: { [piece: string]: number };
  bottomColor: "white" | "black";
  height?: number;
  /**
   * Optional click handler for interactive analysis mode.
   * When provided, reserve pieces become clickable to initiate drops.
   */
  onPieceClick?: (payload: { color: ReserveColor; piece: ReservePiece }) => void;
  /**
   * Optional selection marker (used to show the currently selected drop piece).
   */
  selected?: { color: ReserveColor; piece: ReservePiece } | null;
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
  onPieceClick,
  selected = null,
}) => {
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

  return (
    <div
      className="grid grid-rows-10 bg-gray-800 rounded-lg p-2 w-full overflow-hidden"
      style={{ height: `${height}px` }}
    >
      {slots.map((slot, index) => (
        <div
          key={`${slot.color}-${slot.piece}-${index}`}
          className={[
            "relative flex items-center justify-center rounded",
            slot.count > 0 ? "opacity-100" : "opacity-30",
            onPieceClick && slot.count > 0 ? "cursor-pointer hover:bg-gray-700/50" : "",
            selected?.color === slot.color && selected?.piece === slot.piece
              ? "ring-2 ring-amber-200/60 bg-gray-700/40"
              : "",
          ].join(" ")}
          role={onPieceClick && slot.count > 0 ? "button" : undefined}
          tabIndex={onPieceClick && slot.count > 0 ? 0 : undefined}
          aria-label={
            onPieceClick && slot.count > 0
              ? `Select ${slot.color} ${slot.piece.toUpperCase()} to drop`
              : undefined
          }
          onClick={() => {
            if (!onPieceClick || slot.count <= 0) return;
            onPieceClick({ color: slot.color, piece: slot.piece });
          }}
          onKeyDown={(e) => {
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
            className="w-8 h-8 md:w-10 md:h-10 object-contain shrink-0"
            priority
          />

          {slot.count > 0 && (
            <span className="absolute -bottom-1 -right-1 bg-cyan-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold z-10">
              {slot.count}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

export default PieceReserveVertical;

