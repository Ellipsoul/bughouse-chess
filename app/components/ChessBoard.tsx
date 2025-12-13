"use client";

import { useEffect, useMemo, useRef } from "react";
// Import CSS from the package
import "chessboardjs/www/css/chessboard.css";

interface ChessBoardInstance {
  destroy: () => void;
  // `animated` mirrors chessboard.js docs: position(fen, useAnimation?)
  position: (fen: string, animated?: boolean) => void;
  /**
   * Set or get the board orientation.
   *
   * chessboard.js supports `orientation()` as a getter and `orientation(color)` as a setter.
   * We model both because we may want to query the current orientation in the future.
   */
  orientation: (color?: string) => void | string;
  /**
   * Toggle the board orientation.
   *
   * This is the method requested for user-driven flips so the library stays the
   * source of truth for the internal orientation state + any built-in behaviors.
   */
  flip: () => void;
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

/**
 * Parse a FEN string and map each square to the occupying piece color for styling.
 */
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

/**
 * Client-only wrapper around chessboard.js that keeps the board in sync with game state.
 */
export default function ChessBoard(
  { fen, boardName, size = 400, flip = false, promotedSquares = [] }: ChessBoardProps,
) {
  const boardId = `board-${boardName}`;
  const boardRef = useRef<ChessBoardInstance | null>(null);
  const squareColorMap = useMemo(() => buildSquareColorMap(fen), [fen]);
  const desiredFlipRef = useRef(flip);
  const desiredFenRef = useRef(fen);
  const appliedFlipRef = useRef<boolean | null>(null);

  // Keep the latest desired values available to the async initializer.
  useEffect(() => {
    desiredFlipRef.current = flip;
  }, [flip]);

  useEffect(() => {
    desiredFenRef.current = fen;
  }, [fen]);

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
        position: desiredFenRef.current || "start",
        orientation: desiredFlipRef.current ? "black" : "white",
        pieceTheme: "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
        showNotation: true,
      };

      if (boardRef.current) {
        boardRef.current.destroy();
      }

      boardRef.current = Chessboard(boardId, config);
      appliedFlipRef.current = desiredFlipRef.current;
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

  /**
   * Keep the rendered board synchronized with React state.
   *
   * Important: We intentionally use `board.flip()` (not `board.orientation(...)`) for
   * user-driven orientation toggles so we match the feature request and let chessboard.js
   * own its internal flip state.
   */
  useEffect(() => {
    if (boardRef.current) {
      if (fen) {
        // Disable chessboard.js animation to avoid duplicate-piece blink
        // per https://chessboardjs.com/docs#position.
        boardRef.current.position(fen, false);
      }

      // Flip only when the desired orientation toggles. This prevents accidental
      // double-flips when other props (like `fen` or `size`) update.
      if (appliedFlipRef.current === null) {
        // Board just initialized. Assume config orientation already applied.
        appliedFlipRef.current = flip;
      } else if (appliedFlipRef.current !== flip) {
        boardRef.current.flip();
        appliedFlipRef.current = flip;
      }

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

