"use client";

import { useEffect, useRef } from "react";
// Import CSS from the package
import "chessboardjs/www/css/chessboard.css";

interface ChessBoardProps {
  fen?: string;
  boardName: string;
  size?: number;
  flip?: boolean;
}

export default function ChessBoard(
  { fen, boardName, size = 400, flip = false }: ChessBoardProps,
) {
  const boardId = `board-${boardName}`;
  const boardRef = useRef<any>(null);

  useEffect(() => {
    // Dynamically load dependencies on the client side
    const initBoard = async () => {
      if (typeof window === "undefined") return;

      // Load jQuery and attach to window
      const $ = (await import("jquery")).default;
      (window as any).$ = $;
      (window as any).jQuery = $;

      // Load Chessboard
      // Note: We need to ensure chessboardjs uses the global jQuery or we might need to handle it.
      // Since 'chessboardjs' is a CommonJS module that likely expects global $, 
      // ensuring window.$ is set before import *might* work if we use require, 
      // or if we import it after setting window.$.
      
      const Chessboard = (await import("chessboardjs")).default || (window as any).ChessBoard;

      if (!Chessboard) {
        console.error("Chessboard.js failed to load");
        return;
      }

      const config = {
        position: fen || "start",
        orientation: flip ? "black" : "white",
        pieceTheme: "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
        showNotation: true,
      };

      if (boardRef.current) {
        boardRef.current.destroy();
      }

      boardRef.current = Chessboard(boardId, config);
    };

    initBoard();

    // Cleanup
    return () => {
      if (boardRef.current) {
        boardRef.current.destroy();
      }
    };
    // We only want to initialize once or when fundamental props change that require re-init
    // But mostly we update position via useEffect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update position and orientation when props change
  useEffect(() => {
    if (boardRef.current) {
      if (fen) {
        boardRef.current.position(fen);
      }
      boardRef.current.orientation(flip ? "black" : "white");
      boardRef.current.resize();
    }
  }, [fen, flip, size]);

  return (
    <div className="flex flex-col items-center">
      <div
        id={boardId}
        style={{ width: size }}
      />
       {/* Debug Info */}
      <div className="mt-2 text-xs text-gray-400 text-center">
        {boardName} Board
      </div>
    </div>
  );
}
