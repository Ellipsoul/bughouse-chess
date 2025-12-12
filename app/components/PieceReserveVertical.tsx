import React from "react";

interface PieceReserveVerticalProps {
  whiteReserves: { [piece: string]: number };
  blackReserves: { [piece: string]: number };
  bottomColor: "white" | "black";
  height?: number;
}

const PieceReserveVertical: React.FC<PieceReserveVerticalProps> = ({
  whiteReserves,
  blackReserves,
  bottomColor,
  height = 400,
}) => {
  const pieceOrder = ["p", "n", "b", "r", "q"];
  const isWhiteBottom = bottomColor === "white";

  // Determine the order of pieces to display from top to bottom
  // If White is bottom:
  // Top half: Black pieces (P -> Q going up, so P is top) -> [bP, bN, bB, bR, bQ]
  // Bottom half: White pieces (Q -> P going down, so P is bottom) -> [wQ, wR, wB, wN, wP]
  // Wait, "mirrored" description:
  // "White... see from bottom to top... Pawn, Knight, Bishop, Rook, Queen" -> P (bot).. Q (top)
  // "Mirrored... Queen, Rook, Bishop, Knight and Pawn" -> Q (near middle).. P (far end)
  
  // So visually from Top to Bottom:
  // 1. Far end (Top)
  // ...
  // 5. Near middle
  // 6. Near middle
  // ...
  // 10. Far end (Bottom)

  // If White is bottom:
  // Bottom (10) is wP. Top (6) is wQ.
  // Top (1) is bP. Bottom (5) is bQ.
  
  // Display List (index 0 is Top):
  // [bP, bN, bB, bR, bQ, wQ, wR, wB, wN, wP]

  // If Black is bottom:
  // Bottom (10) is bP. Top (6) is bQ.
  // Top (1) is wP. Bottom (5) is wQ.
  // Display List:
  // [wP, wN, wB, wR, wQ, bQ, bR, bB, bN, bP]

  const topColor = isWhiteBottom ? "black" : "white";
  
  const topPieces = [...pieceOrder]; // [p, n, b, r, q] -> Displayed top to bottom (P at top)
  const bottomPieces = [...pieceOrder].reverse(); // [q, r, b, n, p] -> Displayed top to bottom (Q at top, P at bottom)

  // Construct the full list of 10 slots
  // We need to store: piece type, color, count
  type Slot = { piece: string; color: "white" | "black"; count: number };

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

  const getPieceImage = (piece: string, color: "white" | "black") => {
    const code = color === "white" ? `w${piece.toUpperCase()}` : `b${piece.toUpperCase()}`;
    return `https://chessboardjs.com/img/chesspieces/wikipedia/${code}.png`;
  };

  return (
    <div 
      className="grid grid-rows-10 bg-gray-800 rounded-lg p-2 w-full overflow-hidden"
      style={{ height: `${height}px`, minHeight: "420px" }}
    >
      {slots.map((slot, index) => (
        <div
          key={`${slot.color}-${slot.piece}-${index}`}
          className={`relative flex items-center justify-center ${
            slot.count > 0 ? "opacity-100" : "opacity-30"
          }`}
        >
            <img
              src={getPieceImage(slot.piece, slot.color)}
              alt={`${slot.color} ${slot.piece}`}
              className="w-8 h-8 md:w-10 md:h-10 object-contain flex-shrink-0"
            />
          
          {slot.count > 0 && (
            <span className="absolute -bottom-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold z-10">
              {slot.count}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

export default PieceReserveVertical;

