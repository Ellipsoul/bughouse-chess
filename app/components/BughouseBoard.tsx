"use client";

import "../stores/mobxConfig";
import { observer } from "mobx-react-lite";
import dynamic from "next/dynamic";
import { gameStore } from "../stores/gameStore";
import { PieceReserve } from "./PieceReserve";
import { useState } from "react";

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

  const onPieceDrop1 = (sourceSquare: string, targetSquare: string) => {
    return gameStore.makeMove1(sourceSquare, targetSquare);
  };

  const onPieceDrop2 = (sourceSquare: string, targetSquare: string) => {
    return gameStore.makeMove2(sourceSquare, targetSquare);
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
      <div className="max-w-[1600px] mx-auto w-full">
        <DynamicChessboardDnDProvider>
          <div className="flex flex-col items-center gap-4">
            <div className="flex justify-center gap-4">
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
                      position={gameStore.getFen1()}
                      onPieceDrop={onPieceDrop1}
                      onBoardWidthChange={setBoardWidth}
                      customDarkSquareStyle={boardCustomStyles.darkSquareStyle}
                      customLightSquareStyle={
                        boardCustomStyles.lightSquareStyle
                      }
                      customBoardStyle={boardCustomStyles.boardStyle}
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
                      position={gameStore.getFen2()}
                      onPieceDrop={onPieceDrop2}
                      customDarkSquareStyle={boardCustomStyles.darkSquareStyle}
                      customLightSquareStyle={
                        boardCustomStyles.lightSquareStyle
                      }
                      customBoardStyle={boardCustomStyles.boardStyle}
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
            </div>
          </div>
        </DynamicChessboardDnDProvider>
      </div>
    </div>
  );
});

export default BughouseBoard;
