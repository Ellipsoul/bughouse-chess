"use client";

import { observer } from "mobx-react-lite";
import { SparePiece } from "react-chessboard";
import type { Piece } from "react-chessboard/dist/chessboard/types";

interface PieceReserveProps {
  pieces: { type: string; count: number }[];
  boardWidth: number;
  side: "left" | "right";
}

export const PieceReserve = observer(
  ({ pieces, boardWidth, side }: PieceReserveProps) => {
    const standardPieceOrder = ["P", "N", "B", "R", "Q"];

    const renderPieceColumn = (color: "w" | "b") => (
      <div className="flex flex-col justify-evenly w-16 h-full">
        {standardPieceOrder.map((pieceType) => {
          const piece = pieces.find((p) => p.type === pieceType.toLowerCase());
          const count = piece?.count || 0;
          const pieceId = `${color}${pieceType}` as Piece;

          return (
            <div
              key={`${color}${pieceType}`}
              className={`relative aspect-square w-14 rounded-md
                     ${count > 0 ? "bg-gray-700" : "bg-gray-700/30"}
                     flex items-center justify-center`}
            >
              <div className={`${count === 0 ? "opacity-30" : ""}`}>
                <SparePiece
                  piece={pieceId}
                  width={boardWidth / 8}
                  dndId="BughouseBoard"
                />
              </div>
              {count > 0 && (
                <span
                  className="absolute bottom-0 right-0 bg-indigo-600
                           text-white text-xs rounded-full w-5 h-5
                           flex items-center justify-center"
                >
                  {count}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );

    return (
      <div className="bg-gray-800 p-2 rounded-lg shadow-lg h-full">
        <div className="flex gap-2 h-full">
          {renderPieceColumn("w")}
          {renderPieceColumn("b")}
        </div>
      </div>
    );
  }
);
