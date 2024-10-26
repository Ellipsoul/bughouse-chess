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
  const boardHeaderClasses = "text-lg font-semibold text-white mb-2";
  const boardCustomStyles = {
    darkSquareStyle: { backgroundColor: "#374151" },
    lightSquareStyle: { backgroundColor: "#4B5563" },
    boardStyle: {
      borderRadius: "4px",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    },
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-[1600px] mx-auto">
        <h1 className="text-2xl font-bold text-white mb-4">Bughouse Chess</h1>

        <DynamicChessboardDnDProvider>
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

              {/* Board 1 */}
              <div className={boardContainerClasses}>
                <h2 className={boardHeaderClasses}>Board 1</h2>
                <div className={boardWrapperClasses}>
                  <DynamicChessboard
                    id="board1"
                    position={gameStore.getFen1()}
                    onPieceDrop={onPieceDrop1}
                    onBoardWidthChange={setBoardWidth}
                    customDarkSquareStyle={boardCustomStyles.darkSquareStyle}
                    customLightSquareStyle={boardCustomStyles.lightSquareStyle}
                    customBoardStyle={boardCustomStyles.boardStyle}
                  />
                </div>
              </div>
            </div>

            {/* Right group */}
            <div className="grid grid-cols-[400px_auto] gap-2">
              {/* Board 2 */}
              <div className={boardContainerClasses}>
                <h2 className={boardHeaderClasses}>Board 2</h2>
                <div className={boardWrapperClasses}>
                  <DynamicChessboard
                    id="board2"
                    position={gameStore.getFen2()}
                    onPieceDrop={onPieceDrop2}
                    customDarkSquareStyle={boardCustomStyles.darkSquareStyle}
                    customLightSquareStyle={boardCustomStyles.lightSquareStyle}
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
        </DynamicChessboardDnDProvider>

        {/* Reset Button */}
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => gameStore.resetBoards()}
            className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700
                     transition-colors duration-200 focus:outline-none focus:ring-2
                     focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
          >
            Reset Boards
          </button>
        </div>
      </div>
    </div>
  );
});

export default BughouseBoard;
