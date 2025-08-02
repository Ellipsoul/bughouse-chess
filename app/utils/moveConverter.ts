import { Chess } from 'chess.js';

/**
 * Converts Chess.com move notation to chess.js compatible format
 */
export function convertChessComMoveToChessJs(move: string, chess: Chess): string | null {
  // Handle castling moves
  if (move === 'O-O' || move === '0-0') return 'O-O';
  if (move === 'O-O-O' || move === '0-0-0') return 'O-O-O';
  
  // Remove check/checkmate indicators
  const cleanMove = move.replace(/[+#]$/, '');
  
  // Try the move as-is first
  try {
    const testMove = chess.move(cleanMove);
    if (testMove) {
      chess.undo(); // Undo the test move
      return cleanMove;
    }
  } catch (e) {
    // Continue with conversion attempts
  }
  
  // Handle different move formats that Chess.com might use
  const conversions = [
    // Remove piece name from capture notation (e.g., "Nf3xd4" -> "Nxd4")
    () => cleanMove.replace(/^([NBRQK])[a-h][1-8]x/, '$1x'),
    
    // Try without the source square for captures (e.g., "exd4" might need to be just "exd4")
    () => cleanMove,
    
    // Try with just the destination square for pawn moves
    () => {
      if (/^[a-h][1-8]$/.test(cleanMove)) {
        return cleanMove;
      }
      return null;
    },
    
    // Handle pawn captures (e.g., "exd4" should work in chess.js)
    () => {
      if (/^[a-h]x[a-h][1-8]$/.test(cleanMove)) {
        return cleanMove;
      }
      return null;
    },
    
    // Try removing disambiguation (e.g., "Nbd2" -> "Nd2")
    () => cleanMove.replace(/^([NBRQK])[a-h1-8]([a-h][1-8])/, '$1$2'),
    
    // Try adding disambiguation by looking at legal moves
    () => {
      const legalMoves = chess.moves({ verbose: true });
      
      // Find a legal move that matches our target
      for (const legalMove of legalMoves) {
        if (legalMove.san === cleanMove || 
            legalMove.to === cleanMove.slice(-2) ||
            legalMove.san.replace(/[+#]$/, '') === cleanMove) {
          return legalMove.san;
        }
      }
      return null;
    }
  ];
  
  // Try each conversion method
  for (const convert of conversions) {
    const convertedMove = convert();
    if (convertedMove) {
      try {
        const testMove = chess.move(convertedMove);
        if (testMove) {
          chess.undo(); // Undo the test move
          return convertedMove;
        }
      } catch (e) {
        // Continue trying other conversions
      }
    }
  }
  
  // If nothing works, try to find a legal move by destination square
  const legalMoves = chess.moves({ verbose: true });
  const destinationSquare = cleanMove.slice(-2);
  
  for (const legalMove of legalMoves) {
    if (legalMove.to === destinationSquare) {
      // If there's only one legal move to this square, use it
      const movesToSameSquare = legalMoves.filter(m => m.to === destinationSquare);
      if (movesToSameSquare.length === 1) {
        return legalMove.san;
      }
    }
  }
  
  console.warn(`Could not convert move: ${move} in position ${chess.fen()}`);
  return null;
}

/**
 * Validates and converts a move if necessary
 */
export function validateAndConvertMove(move: string, chess: Chess): string | null {
  // First try the move as-is
  try {
    const result = chess.move(move);
    if (result) {
      chess.undo();
      return move;
    }
  } catch (e) {
    // Try conversion
    return convertChessComMoveToChessJs(move, chess);
  }
  
  return convertChessComMoveToChessJs(move, chess);
}
