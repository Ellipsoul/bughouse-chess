"use client";

import Image from "next/image";
import { memo, useMemo } from "react";

import "chessboardjs/www/css/chessboard.css";

type BoardOrientation = "white" | "black";

interface StaticChessBoardProps {
  fen: string;
  orientation?: BoardOrientation;
  label: string;
  className?: string;
}

interface RenderedSquare {
  square: string;
  piece: string | null;
  light: boolean;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

function parsePosition(fen: string): Map<string, string> {
  const pieces = new Map<string, string>();
  const rows = fen.split(" ")[0]?.split("/") ?? [];

  rows.slice(0, 8).forEach((row, rowIndex) => {
    let fileIndex = 0;
    for (const token of row) {
      if (/\d/.test(token)) {
        fileIndex += Number(token);
      } else if (token === "~") {
        // Some FEN variants mark promoted pieces with a suffix. The marker does
        // not occupy a square and the displayed piece remains the promoted role.
        continue;
      } else if (fileIndex < 8) {
        pieces.set(`${FILES[fileIndex]}${8 - rowIndex}`, token);
        fileIndex += 1;
      }
    }
  });

  return pieces;
}

function pieceCode(piece: string): string {
  const color = piece === piece.toUpperCase() ? "w" : "b";
  return `${color}${piece.toUpperCase()}`;
}

function StaticChessBoard({
  fen,
  orientation = "white",
  label,
  className = "",
}: StaticChessBoardProps) {
  const squares = useMemo<RenderedSquare[]>(() => {
    const pieces = parsePosition(fen);
    const ranks = orientation === "black"
      ? [1, 2, 3, 4, 5, 6, 7, 8]
      : [8, 7, 6, 5, 4, 3, 2, 1];
    const files = orientation === "black" ? [...FILES].reverse() : FILES;

    return ranks.flatMap((rank) => files.map((file) => {
      const square = `${file}${rank}`;
      const fileIndex = FILES.indexOf(file);
      return {
        square,
        piece: pieces.get(square) ?? null,
        light: (fileIndex + rank) % 2 === 0,
      };
    }));
  }, [fen, orientation]);

  return (
    <div
      role="img"
      aria-label={label}
      className={`grid aspect-square w-full grid-cols-8 overflow-hidden rounded-md border-2 border-[#404040] bg-[#404040] shadow-inner ${className}`}
    >
      {squares.map(({ square, piece, light }) => {
        const code = piece ? pieceCode(piece) : null;
        return (
          <span
            key={square}
            data-square={square}
            aria-hidden="true"
            className={`relative grid aspect-square place-items-center ${
              light ? "white-1e1d7" : "black-3c85d"
            }`}
          >
            {code ? (
              <Image
                src={`https://chessboardjs.com/img/chesspieces/wikipedia/${code}.png`}
                alt=""
                aria-hidden="true"
                data-piece={code}
                draggable={false}
                width={100}
                height={100}
                sizes="(max-width: 767px) 2.2rem, 5vw"
                unoptimized
                className="pointer-events-none h-[92%] w-[92%] select-none object-contain"
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

export default memo(StaticChessBoard);
