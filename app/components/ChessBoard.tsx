"use client";

import { useEffect, useMemo, useRef } from "react";
// Import CSS from the package
import "chessboardjs/www/css/chessboard.css";

interface ChessBoardInstance {
  destroy: () => void;
  position: (fen: string) => void;
  orientation: (color: string) => void;
  resize: () => void;
}

type ChessBoardFactory = (id: string, config: Record<string, unknown>) => ChessBoardInstance;

interface CustomWindow extends Window {
  $: unknown;
  jQuery: unknown;
  ChessBoard: ChessBoardFactory | undefined;
}

interface ChessBoardProps {
  fen?: string;
  boardName: string;
  size?: number;
  flip?: boolean;
  promotedSquares?: string[];
}

type PieceColor = "w" | "b";

function buildSquareColorMap(fen?: string): Map<string, PieceColor> {
  const map = new Map<string, PieceColor>();
  if (!fen) return map;

  const parts = fen.split(" ");
  const board = parts[0];
  const rows = board.split("/");
  if (rows.length !== 8) return map;

  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

  for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
    const rankStr = rows[rankIndex];
    let fileIndex = 0;

    for (const ch of rankStr) {
      if (fileIndex >= 8) break;
      if (/\d/.test(ch)) {
        fileIndex += parseInt(ch, 10);
        continue;
      }

      const square = `${files[fileIndex]}${8 - rankIndex}`;
      const color: PieceColor = ch === ch.toUpperCase() ? "w" : "b";
      map.set(square, color);
      fileIndex += 1;
    }
  }

  return map;
}

export default function ChessBoard(
  { fen, boardName, size = 400, flip = false, promotedSquares = [] }: ChessBoardProps,
) {
  const boardId = `board-${boardName}`;
  const boardRef = useRef<ChessBoardInstance | null>(null);
  const squareColorMap = useMemo(() => buildSquareColorMap(fen), [fen]);

  useEffect(() => {
    // Dynamically load dependencies on the client side
    const initBoard = async () => {
      if (typeof window === "undefined") return;

      const customWindow = window as unknown as CustomWindow;

      // Load jQuery and attach to window
      const $ = (await import("jquery")).default;
      customWindow.$ = $;
      customWindow.jQuery = $;

      // Load Chessboard
      // Note: We need to ensure chessboardjs uses the global jQuery or we might need to handle it.
      // Since 'chessboardjs' is a CommonJS module that likely expects global $,
      // ensuring window.$ is set before import *might* work if we use require,
      // or if we import it after setting window.$.

      const ChessboardModule = await import("chessboardjs");
      const Chessboard = ((ChessboardModule as unknown as { default?: ChessBoardFactory }).default || customWindow.ChessBoard) as ChessBoardFactory | undefined;

      if (!Chessboard) {
        console.error("Chessboard.js failed to load");
        return;
      }

      const config: Record<string, unknown> = {
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

  // Decorate promoted pieces with a subtle outline so they are visually distinct.
  useEffect(() => {
    const boardElement = document.getElementById(boardId);
    if (!boardElement) return;

    // Clear old markers
    const existing = boardElement.querySelectorAll(".bh-promoted-square");
    existing.forEach((el) => {
      el.classList.remove("bh-promoted-square");
      el.classList.remove("bh-promoted-square--white");
      el.classList.remove("bh-promoted-square--black");
    });

    // Apply markers for current promoted squares
    promotedSquares.forEach((square) => {
      const squareEl = boardElement.querySelector(`[data-square="${square}"]`);
      if (squareEl instanceof HTMLElement) {
        const color = squareColorMap.get(square);
        squareEl.classList.add("bh-promoted-square");
        if (color === "w") {
          squareEl.classList.add("bh-promoted-square--white");
        } else if (color === "b") {
          squareEl.classList.add("bh-promoted-square--black");
        }
      }
    });
  }, [boardId, promotedSquares, squareColorMap]);

  return (
    <div className="flex flex-col items-center">
      <div
        id={boardId}
        style={{ width: size }}
      />
    </div>
  );
}

