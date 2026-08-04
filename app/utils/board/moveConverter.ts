/**
 * Chess.com SAN → chess.js move-string conversion.
 *
 * External move strings from chess.com payloads are often valid SAN but may use
 * alternate notation (0-0 castling, extra disambiguation, etc.). These helpers
 * probe chess.js legality with tolerant fallbacks before rejecting a move.
 */
import { Chess } from "chess.js";

/**
 * Converts Chess.com move notation to a chess.js-compatible move string.
 *
 * Tries the move as-is first, then a sequence of heuristic rewrites (capture
 * notation cleanup, disambiguation stripping, destination-square matching).
 * Returns null when no legal interpretation exists in the current position.
 */
export function convertChessComMoveToChessJs(
  move: string,
  chess: Chess,
): string | null {
  /**
   * We intentionally keep conversion tolerant: callers may feed in imperfect SAN,
   * wrong-turn moves, or other invalid strings when parsing external sources.
   *
   * Logging those failures is useful in development, but it can be extremely
   * noisy in unit tests (where invalid moves are often exercised deliberately).
   */
  const shouldLog = (): boolean =>
    process.env.NODE_ENV !== "test" && process.env.VITEST !== "true";

  /** Emit a console.error when conversion fails, suppressed during test runs. */
  const logConversionError = (message: string): void => {
    if (!shouldLog()) return;
    console.error(message);
  };

  /** Emit a console.warn for soft conversion failures, suppressed during test runs. */
  const logConversionWarning = (message: string): void => {
    if (!shouldLog()) return;
    console.warn(message);
  };

  // Handle castling moves
  if (move === "O-O" || move === "0-0") return "O-O";
  if (move === "O-O-O" || move === "0-0-0") return "O-O-O";

  // Remove check/checkmate indicators
  const cleanMove = move.replace(/[+#]$/, "");

  // Try the move as-is first
  try {
    const testMove = chess.move(cleanMove);
    if (testMove) {
      chess.undo(); // Undo the test move
      return cleanMove;
    }
  } catch (e) {
    // Continue with conversion attempts
    logConversionError(
      `Error converting move: ${move} in position ${chess.fen()} with error ${e}`,
    );
  }

  // Handle different move formats that Chess.com might use
  const conversions = [
    // Remove piece name from capture notation (e.g., "Nf3xd4" -> "Nxd4")
    () => cleanMove.replace(/^([NBRQK])[a-h][1-8]x/, "$1x"),

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
    () => cleanMove.replace(/^([NBRQK])[a-h1-8]([a-h][1-8])/, "$1$2"),

    // Try adding disambiguation by looking at legal moves
    () => {
      const legalMoves = chess.moves({ verbose: true });

      // Find a legal move that matches our target
      for (const legalMove of legalMoves) {
        if (
          legalMove.san === cleanMove ||
          legalMove.to === cleanMove.slice(-2) ||
          legalMove.san.replace(/[+#]$/, "") === cleanMove
        ) {
          return legalMove.san;
        }
      }
      return null;
    },
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
        logConversionError(
          `Error converting move: ${convertedMove} in position ${chess.fen()} with error ${e}`,
        );
      }
    }
  }

  // If nothing works, try to find a legal move by destination square
  const legalMoves = chess.moves({ verbose: true });
  const destinationSquare = cleanMove.slice(-2);

  for (const legalMove of legalMoves) {
    if (legalMove.to === destinationSquare) {
      // If there's only one legal move to this square, use it
      const movesToSameSquare = legalMoves.filter((m) =>
        m.to === destinationSquare
      );
      if (movesToSameSquare.length === 1) {
        return legalMove.san;
      }
    }
  }

  logConversionWarning(
    `Could not convert move: ${move} in position ${chess.fen()}`,
  );
  return null;
}

/**
 * Validate a move string against the current position, converting if necessary.
 *
 * Attempts a direct chess.js parse first; on failure delegates to
 * {@link convertChessComMoveToChessJs} for heuristic recovery.
 */
export function validateAndConvertMove(
  move: string,
  chess: Chess,
): string | null {
  const shouldLog = (): boolean =>
    process.env.NODE_ENV !== "test" && process.env.VITEST !== "true";

  // First try the move as-is
  try {
    const result = chess.move(move);
    if (result) {
      chess.undo();
      return move;
    }
  } catch (e) {
    // Try conversion
    if (shouldLog()) {
      console.error(
        `Error validating and converting move: ${move} in position ${chess.fen()} with error ${e}`,
      );
    }
    return convertChessComMoveToChessJs(move, chess);
  }

  return convertChessComMoveToChessJs(move, chess);
}
