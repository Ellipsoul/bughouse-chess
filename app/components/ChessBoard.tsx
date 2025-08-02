"use client";

import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';

interface ChessBoardProps {
  fen?: string;
  boardName: string;
  size?: number;
  flip?: boolean;
}

export default function ChessBoard({ fen, boardName, size = 400, flip = false }: ChessBoardProps) {
  const [chess] = useState(new Chess());
  const [currentFen, setCurrentFen] = useState(fen || chess.fen());

  useEffect(() => {
    if (fen) {
      try {
        chess.load(fen);
        setCurrentFen(fen);
      } catch (error) {
        console.error('Invalid FEN:', error);
      }
    }
  }, [fen, chess]);

  const renderBoard = () => {
    const board = chess.board();
    const squares = [];

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const actualRank = flip ? rank : 7 - rank;
        const actualFile = flip ? 7 - file : file;
        const square = board[actualRank][actualFile];
        const isLight = (rank + file) % 2 === 0;
        const squareId = String.fromCharCode(97 + actualFile) + (actualRank + 1);

        squares.push(
          <div
            key={`${rank}-${file}`}
            className={`
              relative flex items-center justify-center text-2xl font-bold
              ${isLight ? 'bg-amber-100' : 'bg-amber-800'}
              border border-gray-400
            `}
            style={{
              width: size / 8,
              height: size / 8,
            }}
            data-square={squareId}
          >
            {square && (
              <span className={square.color === 'w' ? 'text-black drop-shadow-md' : 'text-white drop-shadow-md'}>
                {getPieceSymbol(square.type, square.color)}
              </span>
            )}
            
            {/* Coordinates */}
            {file === 0 && (
              <span className="absolute top-0.5 left-0.5 text-xs font-semibold text-gray-600">
                {actualRank + 1}
              </span>
            )}
            {rank === 7 && (
              <span className="absolute bottom-0.5 right-0.5 text-xs font-semibold text-gray-600">
                {String.fromCharCode(97 + actualFile)}
              </span>
            )}
          </div>
        );
      }
    }

    return squares;
  };

  const getPieceSymbol = (type: string, color: string): string => {
    const pieces: Record<string, Record<string, string>> = {
      w: { p: '♙', r: '♖', n: '♘', b: '♗', q: '♕', k: '♔' },
      b: { p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚' }
    };
    return pieces[color][type] || '';
  };

  return (
    <div className="flex flex-col items-center">
      <div className="mb-2">
        <h3 className="text-lg font-semibold text-white text-center">
          Board {boardName}
        </h3>
      </div>
      
      <div 
        className="grid grid-cols-8 border-2 border-gray-600 shadow-lg"
        style={{ width: size, height: size }}
      >
        {renderBoard()}
      </div>
      
      <div className="mt-2 text-xs text-gray-400 text-center">
        <div>FEN: {currentFen.split(' ')[0]}</div>
        <div>Turn: {chess.turn() === 'w' ? 'White' : 'Black'}</div>
      </div>
    </div>
  );
}
