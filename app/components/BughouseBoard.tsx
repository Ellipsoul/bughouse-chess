"use client";

import { observer } from "mobx-react-lite";
import { useState } from "react";
import dynamic from "next/dynamic";

import { Chess, Move, Square } from "chess.js";

import { PieceReserve } from "./PieceReserve";
import { CapturedPiece } from "../types/bughouseStore.types";
import { SquareStyles } from "../types/bughouseBoard.types";

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

const BughouseBoard = observer(() => {
  // Reduce the board width for a more compact layout
  const [boardWidth, setBoardWidth] = useState(400);

  // Add state for board orientation
  const [isFlipped, setIsFlipped] = useState(false);

  const [boardA] = useState(new Chess());
  const [boardB] = useState(new Chess());

  const [positionA, setPositionA] = useState(boardA.fen());
  const [positionB, setPositionB] = useState(boardB.fen());

  const [teamAHolding, setTeamAHolding] = useState<CapturedPiece[]>([]);
  const [teamBHolding, setTeamBHolding] = useState<CapturedPiece[]>([]);

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

  const handleCapture = (board: Chess, move: Move, isTeamA: boolean) => {
    if (!move.captured) return;

    const capturedPiece: CapturedPiece = {
      type: move.captured.toLowerCase(),
      color: move.color === "w" ? "b" : ("w" as "w" | "b"),
      count: 1,
    };

    // If on board A, pieces go to board B's reserves and vice versa
    const targetHolding = isTeamA ? teamBHolding : teamAHolding;
    const setTargetHolding = isTeamA ? setTeamBHolding : setTeamAHolding;

    const newHolding = [...targetHolding];
    const existingPiece = newHolding.find(
      (p) => p.type === capturedPiece.type && p.color === capturedPiece.color
    );

    if (existingPiece) {
      existingPiece.count++;
    } else {
      newHolding.push(capturedPiece);
    }

    setTargetHolding(newHolding);
  };

  const removePieceFromHolding = (piece: string, isTeamA: boolean) => {
    const holding = isTeamA ? teamAHolding : teamBHolding;
    const setHolding = isTeamA ? setTeamAHolding : setTeamBHolding;

    const newHolding = [...holding];
    const existingPiece = newHolding.find((p) => p.type === piece);

    if (existingPiece && existingPiece.count > 0) {
      existingPiece.count--;
      if (existingPiece.count === 0) {
        const index = newHolding.indexOf(existingPiece);
        newHolding.splice(index, 1);
      }
      setHolding(newHolding);
    }
  };

  const isValidDrop = (
    piece: string,
    square: Square,
    board: Chess
  ): boolean => {
    // Prevent pawn drops on first and last ranks
    if (piece.toLowerCase() === "p") {
      const rank = square[1];
      if (rank === "1" || rank === "8") {
        console.log("Cannot drop pawns on first or last rank");
        return false;
      }
    }

    // Check if square is empty
    return !board.get(square);
  };

  const onPieceDrop1 = (
    sourceSquare: string,
    targetSquare: string,
    piece: string
  ) => {
    if (!targetSquare) {
      console.log("Piece dropped outside board A");
      return false;
    }

    try {
      // Handle drops from piece reserve
      if (sourceSquare === "spare") {
        const pieceType = piece.toLowerCase()[1];
        const isWhitePiece = piece[0] === "w";
        const holding = isWhitePiece ? teamAHolding : teamBHolding;

        // Check if piece is available in holdings
        if (!holding.find((p) => p.type === pieceType && p.count > 0)) {
          console.log("Piece not available in holdings");
          return false;
        }

        // Validate drop
        if (!isValidDrop(pieceType, targetSquare as Square, boardA)) {
          return false;
        }

        const move = `${pieceType}@${targetSquare}`;
        const result = boardA.move(move);

        if (result) {
          setPositionA(boardA.fen());
          removePieceFromHolding(pieceType, isWhitePiece);
          return true;
        }
        return false;
      }

      // Handle regular moves
      const move = {
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      };

      const result = boardA.move(move);
      if (result) {
        setPositionA(boardA.fen());
        handleCapture(boardA, result, true);
        return true;
      }
      return false;
    } catch (e) {
      console.log("Invalid move attempted on board A", e);
      return false;
    }
  };

  const onPieceDrop2 = (
    sourceSquare: string,
    targetSquare: string,
    piece: string
  ) => {
    // Similar implementation for board B with proper types
    if (!targetSquare) {
      console.log(`Piece dropped outside board B`);
      return false;
    }

    try {
      // Handle drops from piece reserve
      if (sourceSquare === "spare") {
        const pieceType = piece.toLowerCase()[1];
        const isWhitePiece = piece[0] === "w";
        const holding = isWhitePiece ? teamBHolding : teamBHolding;

        // Check if piece is available in holdings
        if (!holding.find((p) => p.type === pieceType && p.count > 0)) {
          console.log("Piece not available in holdings");
          return false;
        }

        // Validate drop
        if (!isValidDrop(pieceType, targetSquare as Square, boardB)) {
          return false;
        }

        const move = `${pieceType}@${targetSquare}`;
        const result = boardB.move(move);

        if (result) {
          setPositionB(boardB.fen());
          removePieceFromHolding(pieceType, isWhitePiece);
          return true;
        }
        return false;
      }

      // Handle regular moves
      const move = {
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      };

      const result = boardB.move(move);
      if (result) {
        setPositionB(boardB.fen());
        handleCapture(boardB, result, false);
        return true;
      }
      return false;
    } catch (e) {
      console.log("Invalid move attempted on board B", e);
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
                  pieces={teamAHolding}
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
                  pieces={teamBHolding}
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
