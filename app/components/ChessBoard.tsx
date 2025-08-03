"use client";

import { useEffect, useState } from "react";
import { Chess } from "chess.js";

interface ChessBoardProps {
  fen?: string;
  boardName: string;
  size?: number;
  flip?: boolean;
}

export default function ChessBoard(
  { fen, boardName, size = 400, flip = false }: ChessBoardProps,
) {
  const [chess] = useState(new Chess());
  const [currentFen, setCurrentFen] = useState(fen || chess.fen());

  useEffect(() => {
    if (fen) {
      try {
        chess.load(fen);
        setCurrentFen(fen);
      } catch (error) {
        console.error("Invalid FEN:", error);
      }
    }
  }, [fen, chess]);

  const renderBoard = () => {
    const board = chess.board();
    const squares = [];

    // Clear mapping:
    // chess.board()[0] = rank 1 (a1, b1, c1, ..., h1)
    // chess.board()[7] = rank 8 (a8, b8, c8, ..., h8)
    //
    // Our display grid goes from top-left to bottom-right
    // We want:
    // - flip=false: rank 8 at top, rank 1 at bottom (White perspective)
    // - flip=true: rank 1 at top, rank 8 at bottom (Black perspective)

    for (let displayRow = 0; displayRow < 8; displayRow++) {
      for (let displayCol = 0; displayCol < 8; displayCol++) {
        // Map display position to chess board position
        let chessRank, chessFile;

        if (flip) {
          // Black perspective: rank 1 at top, rank 8 at bottom
          chessRank = displayRow; // displayRow 0 -> rank 1 (board[0])
          chessFile = 7 - displayCol; // displayCol 0 -> file h (index 7)
        } else {
          // White perspective: rank 8 at top, rank 1 at bottom
          chessRank = 7 - displayRow; // displayRow 0 -> rank 8 (board[7])
          chessFile = displayCol; // displayCol 0 -> file a (index 0)
        }

        const square = board[chessRank][chessFile];
        const isLight = (displayRow + displayCol) % 2 === 0;
        const squareId = String.fromCharCode(97 + chessFile) + (chessRank + 1);

        // Debug: log corner squares to verify mapping
        if (
          (displayRow === 0 || displayRow === 7) &&
          (displayCol === 0 || displayCol === 7)
        ) {
          console.log(
            `${
              flip ? "FLIPPED" : "NORMAL"
            } Display (${displayRow},${displayCol}) -> Chess (${chessRank},${chessFile}) -> Square ${squareId} -> Piece: ${square?.type}${square?.color}`,
          );
        }

        squares.push(
          <div
            key={`${displayRow}-${displayCol}`}
            className={`
              relative flex items-center justify-center text-2xl font-bold
              ${isLight ? "bg-amber-100" : "bg-amber-800"}
              border border-gray-400
            `}
            style={{
              width: size / 8,
              height: size / 8,
            }}
            data-square={squareId}
          >
            {square && (
              <span
                className={square.color === "w"
                  ? "text-black drop-shadow-md"
                  : "text-white drop-shadow-md"}
              >
                {getPieceSymbol(square.type, square.color)}
              </span>
            )}

            {/* Coordinates */}
            {displayCol === 0 && (
              <span className="absolute top-0.5 left-0.5 text-xs font-semibold text-gray-600">
                {chessRank + 1}
              </span>
            )}
            {displayRow === 7 && (
              <span className="absolute bottom-0.5 right-0.5 text-xs font-semibold text-gray-600">
                {String.fromCharCode(97 + chessFile)}
              </span>
            )}
          </div>,
        );
      }
    }

    return squares;
  };

  const getPieceSymbol = (type: string, color: string): string => {
    const pieces: Record<string, Record<string, string>> = {
      w: { p: "♙", r: "♖", n: "♘", b: "♗", q: "♕", k: "♔" },
      b: { p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚" },
    };
    return pieces[color][type] || "";
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className="grid grid-cols-8 border-2 border-gray-600 shadow-lg"
        style={{ width: size, height: size }}
      >
        {renderBoard()}
      </div>

      <div className="mt-2 text-xs text-gray-400 text-center">
        <div>FEN: {currentFen.split(" ")[0]}</div>
        <div>Turn: {chess.turn() === "w" ? "White" : "Black"}</div>
      </div>
    </div>
  );
}
