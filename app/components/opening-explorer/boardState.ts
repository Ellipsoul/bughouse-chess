/**
 * @module opening-explorer/boardState
 *
 * Lightweight TCN prefix replay for the opening-explorer board.
 *
 * The explorer displays a single board derived from the exact move-prefix path
 * returned by the packed trie. This module intentionally does not share the
 * two-board viewer analysis tree, clocks, reserves, or variation state.
 *
 * Node identity remains the move-token sequence; FEN placement is display-only
 * and must never be used to merge transposed prefixes.
 */

/** Chess.com TCN alphabet used to encode from/to square indices and drop codes. */
const TCN_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?{~}(^)[_]@#$,./&-*++=";

/** Piece letters encoded into TCN drop and promotion channels. */
const DROP_AND_PROMOTION_PIECES = "qnrbkp";

/** File letters for square index conversion. */
const FILES = "abcdefgh";

/**
 * One decoded ply along an opening prefix, ready for UI labels and highlights.
 */
export interface OpeningMove {
  /** Original two-character TCN token. */
  token: string;
  /** Origin square for ordinary moves, or `null` for drops. */
  from: string | null;
  /** Destination square. */
  to: string;
  /** Dropped piece letter when this ply is a drop, otherwise `null`. */
  drop: string | null;
  /** Promotion piece letter when applicable, otherwise `null`. */
  promotion: string | null;
  /** Compact SAN-like label for move-list display. */
  label: string;
}

/**
 * Display state for an exact opening prefix.
 */
export interface OpeningPosition {
  /** Partial FEN (placement, side, castling, en passant) for the board widget. */
  fen: string;
  /** Decoded plies along the prefix. */
  moves: OpeningMove[];
  /** Last ply endpoints for board highlighting. */
  lastMove: { from: string | null; to: string } | null;
}

/**
 * Internal decoded TCN move before board application.
 */
interface DecodedMove {
  from?: string;
  to: string;
  drop?: string;
  promotion?: string;
}

/**
 * Converts a 0–63 square index into algebraic notation.
 *
 * @param index - Square index with a1 = 0 and files cycling first.
 */
function square(index: number): string {
  return `${FILES[index % 8]}${Math.floor(index / 8) + 1}`;
}

/**
 * Decodes a two-character Chess.com TCN token into from/to/drop/promotion.
 *
 * Target indices above 63 encode promotions; source indices above 75 encode
 * drops. Invalid alphabet characters or lengths throw.
 *
 * @param token - Exact two-character TCN token from the packed trie.
 */
function decodeToken(token: string): DecodedMove {
  if (token.length !== 2) {
    throw new Error(`Invalid TCN token: ${token}`);
  }

  const sourceIndex = TCN_ALPHABET.indexOf(token[0]);
  let targetIndex = TCN_ALPHABET.indexOf(token[1]);

  if (sourceIndex < 0 || targetIndex < 0) {
    throw new Error(`Unknown TCN token: ${token}`);
  }

  const move: Partial<DecodedMove> = {};

  if (targetIndex > 63) {
    move.promotion = DROP_AND_PROMOTION_PIECES[Math.floor((targetIndex - 64) / 3)];
    targetIndex = sourceIndex + (sourceIndex < 16 ? -8 : 8) + ((targetIndex - 64) % 3) - 1;
  }

  if (sourceIndex > 75) {
    move.drop = DROP_AND_PROMOTION_PIECES[sourceIndex - 79];
  } else {
    move.from = square(sourceIndex);
  }

  move.to = square(targetIndex);

  return move as DecodedMove;
}

/**
 * Builds the standard chess starting placement as a mutable square map.
 */
function startingBoard(): Map<string, string> {
  const board = new Map<string, string>();
  const ranks = ["rnbqkbnr", "pppppppp", "", "", "", "", "PPPPPPPP", "RNBQKBNR"];

  ranks.forEach((pieces, rankIndex) => {
    const rank = 8 - rankIndex;

    [...pieces].forEach((piece, fileIndex) => {
      board.set(`${FILES[fileIndex]}${rank}`, piece);
    });
  });

  return board;
}

/**
 * Serializes a square map into FEN placement (ranks joined by `/`).
 *
 * @param board - Current piece placement keyed by algebraic square.
 */
function placement(board: Map<string, string>): string {
  const ranks: string[] = [];

  for (let rank = 8; rank >= 1; rank -= 1) {
    let row = "";
    let empty = 0;

    for (const file of FILES) {
      const piece = board.get(`${file}${rank}`);

      if (!piece) {
        empty += 1;
      } else {
        if (empty) row += String(empty);
        empty = 0;
        row += piece;
      }
    }

    if (empty) row += String(empty);
    ranks.push(row);
  }

  return ranks.join("/");
}

/**
 * Builds a compact display label for a decoded move on the current board.
 *
 * Castling, captures, pawn promotions, and drops are covered; disambiguation
 * beyond capture/file notation is intentionally omitted for explorer brevity.
 *
 * @param board - Placement before the move is applied.
 * @param move - Decoded TCN move.
 */
function moveLabel(board: Map<string, string>, move: DecodedMove): string {
  if (move.drop) {
    return `${move.drop.toUpperCase()}@${move.to}`;
  }

  const from = move.from as string;
  const piece = board.get(from);

  if (!piece) {
    throw new Error(`TCN move starts on an empty square: ${from}${move.to}`);
  }

  const pieceType = piece.toUpperCase();

  if (pieceType === "K" && Math.abs(FILES.indexOf(from[0]) - FILES.indexOf(move.to[0])) === 2) {
    return move.to[0] === "g" ? "O-O" : "O-O-O";
  }

  const capture = board.has(move.to) || (pieceType === "P" && from[0] !== move.to[0]);

  if (pieceType === "P") {
    return `${capture ? `${from[0]}x` : ""}${move.to}${move.promotion ? `=${move.promotion.toUpperCase()}` : ""}`;
  }

  return `${pieceType}${capture ? "x" : ""}${move.to}`;
}

/**
 * Replays an exact TCN token prefix into display FEN and labeled moves.
 *
 * Handles ordinary moves, promotions, castling rook slides, en passant capture
 * squares, and bughouse drops. Throws if a token cannot be applied safely.
 *
 * @param tokens - Ordered TCN tokens from the explorer path (root excluded).
 */
export function replayOpeningPrefix(tokens: readonly string[]): OpeningPosition {
  const board = startingBoard();
  const castling = new Set(["K", "Q", "k", "q"]);
  let whiteToMove = true;
  let enPassant: string | null = null;
  const moves: OpeningMove[] = [];

  for (const token of tokens) {
    const decoded = decodeToken(token);
    const label = moveLabel(board, decoded);

    if (decoded.drop) {
      board.set(
        decoded.to,
        whiteToMove ? decoded.drop.toUpperCase() : decoded.drop.toLowerCase(),
      );
      enPassant = null;
    } else {
      const from = decoded.from as string;
      let piece = board.get(from);

      if (!piece) {
        throw new Error(`TCN move starts on an empty square: ${from}${decoded.to}`);
      }

      board.delete(from);

      const pawn = piece.toUpperCase() === "P";

      if (pawn && from[0] !== decoded.to[0] && !board.has(decoded.to) && decoded.to === enPassant) {
        board.delete(`${decoded.to[0]}${from[1]}`);
      }

      if (
        piece.toUpperCase() === "K"
        && Math.abs(FILES.indexOf(from[0]) - FILES.indexOf(decoded.to[0])) === 2
      ) {
        const rank = from[1];
        const kingSide = decoded.to[0] === "g";
        const rookFrom = `${kingSide ? "h" : "a"}${rank}`;
        const rookTo = `${kingSide ? "f" : "d"}${rank}`;
        const rook = board.get(rookFrom);

        if (rook) {
          board.delete(rookFrom);
          board.set(rookTo, rook);
        }
      }

      let nextEnPassant: string | null = null;

      if (pawn && Math.abs(Number(decoded.to[1]) - Number(from[1])) === 2) {
        nextEnPassant = `${decoded.to[0]}${(Number(decoded.to[1]) + Number(from[1])) / 2}`;
      }

      if (decoded.promotion) {
        piece = whiteToMove
          ? decoded.promotion.toUpperCase()
          : decoded.promotion.toLowerCase();
      }

      for (const touched of [from, decoded.to]) {
        if (touched === "e1") {
          castling.delete("K");
          castling.delete("Q");
        }

        if (touched === "e8") {
          castling.delete("k");
          castling.delete("q");
        }

        if (touched === "h1") castling.delete("K");
        if (touched === "a1") castling.delete("Q");
        if (touched === "h8") castling.delete("k");
        if (touched === "a8") castling.delete("q");
      }

      board.set(decoded.to, piece);
      enPassant = nextEnPassant;
    }

    moves.push({
      token,
      from: decoded.from ?? null,
      to: decoded.to,
      drop: decoded.drop ?? null,
      promotion: decoded.promotion ?? null,
      label,
    });

    whiteToMove = !whiteToMove;
  }

  const rights = ["K", "Q", "k", "q"].filter((right) => castling.has(right)).join("") || "-";

  return {
    fen: `${placement(board)} ${whiteToMove ? "w" : "b"} ${rights} ${enPassant ?? "-"}`,
    moves,
    lastMove: moves.length
      ? { from: moves.at(-1)?.from ?? null, to: moves.at(-1)?.to as string }
      : null,
  };
}
