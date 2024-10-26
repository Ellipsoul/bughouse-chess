"use client";

import { observer } from "mobx-react-lite";
import { useState } from "react";
import { Chess, Move, Square } from "chess.js";
import { PieceReserve } from "./PieceReserve";
import dynamic from "next/dynamic";
import { gameStore } from "../stores/gameStore";

// Dynamically import ChessboardDnDProvider with SSR disabled
const DynamicChessboardDnDProvider = dynamic(
  () => import("react-chessboard").then((mod) => mod.ChessboardDnDProvider),
  { ssr: false }
);

// Dynamically import Chessboard with SSR disabled
const DynamicChessboard = dynamic(
  () => import("react-chessboard").then((mod) => mod.Chessboard),
  { ssr: false }
);

interface SquareStyle {
  background: string;
  borderRadius?: string;
}

interface SquareStyles {
  [square: string]: SquareStyle;
}

const BughouseBoard = observer(() => {
  // Reduce the board width for a more compact layout
  const [boardWidth, setBoardWidth] = useState(400);

  // Add state for board orientation
  const [isFlipped, setIsFlipped] = useState(false);

  const [boardA] = useState(new Chess());
  const [boardB] = useState(new Chess());

  const [positionA, setPositionA] = useState(boardA.fen());
  const [positionB, setPositionB] = useState(boardB.fen());

  // Click-to-move state
  const [moveFromA, setMoveFromA] = useState<Square | "">("");
  const [moveFromB, setMoveFromB] = useState<Square | "">("");
  const [optionSquaresA, setOptionSquaresA] = useState<SquareStyles>({});
  const [optionSquaresB, setOptionSquaresB] = useState<SquareStyles>({});

  const getMoveOptions = (
    square: Square,
    board: Chess,
    setOptionSquares: (squares: SquareStyles) => void
  ): boolean => {
    const moves = board.moves({ square, verbose: true }) as Move[];
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const newSquares: SquareStyles = {};
    moves.forEach((move) => {
      const piece = board.get(square);
      const targetPiece = board.get(move.to as Square);

      newSquares[move.to] = {
        background:
          targetPiece && targetPiece.color !== piece?.color
            ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
        borderRadius: "50%",
      };
    });

    newSquares[square] = {
      background: "rgba(255, 255, 0, 0.4)",
    };

    setOptionSquares(newSquares);
    return true;
  };

  const onSquareClickA = (square: Square) => {
    // from square
    if (!moveFromA) {
      const hasMoveOptions = getMoveOptions(square, boardA, setOptionSquaresA);
      if (hasMoveOptions) setMoveFromA(square);
      return;
    }

    // to square
    try {
      const result = boardA.move({
        from: moveFromA,
        to: square,
        promotion: "q",
      });

      if (result) {
        setPositionA(boardA.fen());
        setMoveFromA("");
        setOptionSquaresA({});
      } else {
        // Check if clicked on a new piece
        const hasMoveOptions = getMoveOptions(
          square,
          boardA,
          setOptionSquaresA
        );
        setMoveFromA(hasMoveOptions ? square : "");
      }
    } catch {
      const hasMoveOptions = getMoveOptions(square, boardA, setOptionSquaresA);
      setMoveFromA(hasMoveOptions ? square : "");
    }
  };

  const onSquareClickB = (square: Square) => {
    // Similar implementation for board B with proper types
    if (!moveFromB) {
      const hasMoveOptions = getMoveOptions(square, boardB, setOptionSquaresB);
      if (hasMoveOptions) setMoveFromB(square);
      return;
    }

    try {
      const result = boardB.move({
        from: moveFromB,
        to: square,
        promotion: "q",
      });

      if (result) {
        setPositionB(boardB.fen());
        setMoveFromB("");
        setOptionSquaresB({});
      } else {
        const hasMoveOptions = getMoveOptions(
          square,
          boardB,
          setOptionSquaresB
        );
        setMoveFromB(hasMoveOptions ? square : "");
      }
    } catch {
      const hasMoveOptions = getMoveOptions(square, boardB, setOptionSquaresB);
      setMoveFromB(hasMoveOptions ? square : "");
    }
  };

  const onPieceDrop1 = (
    sourceSquare: string,
    targetSquare: string,
    piece: string
  ) => {
    // If dropped outside the board, return false immediately
    if (!targetSquare) {
      console.log(`Piece dropped outside board A`);
      return false;
    }

    try {
      const move = {
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      };

      const result = boardA.move(move);
      if (result !== null) {
        setPositionA(boardA.fen());
        return true;
      }
      console.log(
        `Illegal move attempted on board A: ${sourceSquare} → ${targetSquare}`
      );
      return false;
    } catch {
      console.log(
        `Illegal move attempted on board A: ${sourceSquare} → ${targetSquare}`
      );
      return false;
    }
  };

  const onPieceDrop2 = (
    sourceSquare: string,
    targetSquare: string,
    piece: string
  ) => {
    // If dropped outside the board, return false immediately
    if (!targetSquare) {
      console.log(`Piece dropped outside board B`);
      return false;
    }

    try {
      const move = {
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      };

      const result = boardB.move(move);
      if (result !== null) {
        setPositionB(boardB.fen());
        return true;
      }
      console.log(
        `Illegal move attempted on board B: ${sourceSquare} → ${targetSquare}`
      );
      return false;
    } catch {
      console.log(
        `Illegal move attempted on board B: ${sourceSquare} → ${targetSquare}`
      );
      return false;
    }
  };

  // Common CSS classes
  const boardContainerClasses = "bg-gray-800 p-3 rounded-lg shadow-lg";
  const boardWrapperClasses = "w-128 aspect-square";
  const boardCustomStyles = {
    darkSquareStyle: { backgroundColor: "#374151" },
    lightSquareStyle: { backgroundColor: "#4B5563" },
    boardStyle: {
      borderRadius: "4px",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    },
  };

  const navigationButtonClasses =
    "px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900";

  return (
    <div className="min-h-screen bg-gray-900 p-4 flex items-center">
      <div className="mx-auto w-full">
        <DynamicChessboardDnDProvider>
          <div className="flex flex-col items-center gap-4">
            <div className="flex justify-center gap-12">
              {/* Left group */}
              <div className="grid grid-cols-[auto_400px] gap-2">
                <PieceReserve
                  side="left"
                  pieces={gameStore.capturedPiecesTeam1.reduce((acc, piece) => {
                    const existing = acc.find((p) => p.type === piece.type);
                    if (existing) {
                      existing.count++;
                    } else {
                      acc.push({ type: piece.type, count: 1 });
                    }
                    return acc;
                  }, [] as { type: string; count: number }[])}
                  boardWidth={boardWidth}
                />

                <div className={boardContainerClasses}>
                  <div className={boardWrapperClasses}>
                    <DynamicChessboard
                      id="board1"
                      position={positionA}
                      onPieceDrop={onPieceDrop1}
                      onSquareClick={onSquareClickA}
                      onBoardWidthChange={setBoardWidth}
                      boardOrientation={isFlipped ? "black" : "white"}
                      customDarkSquareStyle={boardCustomStyles.darkSquareStyle}
                      customLightSquareStyle={
                        boardCustomStyles.lightSquareStyle
                      }
                      customBoardStyle={boardCustomStyles.boardStyle}
                      customSquareStyles={optionSquaresA}
                    />
                  </div>
                </div>
              </div>

              {/* Right group */}
              <div className="grid grid-cols-[400px_auto] gap-2">
                <div className={boardContainerClasses}>
                  <div className={boardWrapperClasses}>
                    <DynamicChessboard
                      id="board2"
                      position={positionB}
                      onPieceDrop={onPieceDrop2}
                      onSquareClick={onSquareClickB}
                      boardOrientation={isFlipped ? "white" : "black"}
                      customDarkSquareStyle={boardCustomStyles.darkSquareStyle}
                      customLightSquareStyle={
                        boardCustomStyles.lightSquareStyle
                      }
                      customBoardStyle={boardCustomStyles.boardStyle}
                      customSquareStyles={optionSquaresB}
                    />
                  </div>
                </div>

                <PieceReserve
                  side="right"
                  pieces={gameStore.capturedPiecesTeam2.reduce((acc, piece) => {
                    const existing = acc.find((p) => p.type === piece.type);
                    if (existing) {
                      existing.count++;
                    } else {
                      acc.push({ type: piece.type, count: 1 });
                    }
                    return acc;
                  }, [] as { type: string; count: number }[])}
                  boardWidth={boardWidth}
                />
              </div>
            </div>

            {/* Navigation Controls */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  /* TODO: Reset game */
                }}
                className={navigationButtonClasses}
                title="Reset game"
              >
                <span>⏮</span>
              </button>
              <button
                onClick={() => {
                  /* TODO: Previous move */
                }}
                className={navigationButtonClasses}
                title="Previous move"
              >
                <span>⏪</span>
              </button>
              <button
                onClick={() => {
                  /* TODO: Next move */
                }}
                className={navigationButtonClasses}
                title="Next move"
              >
                <span>⏩</span>
              </button>
              <button
                onClick={() => {
                  /* TODO: Last move */
                }}
                className={navigationButtonClasses}
                title="Last move"
              >
                <span>⏭</span>
              </button>
              <button
                onClick={() => setIsFlipped(!isFlipped)}
                className={navigationButtonClasses}
                title="Flip boards"
              >
                <span>⟲</span>
              </button>
            </div>
          </div>
        </DynamicChessboardDnDProvider>
      </div>
    </div>
  );
});

export default BughouseBoard;
