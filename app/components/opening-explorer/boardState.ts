const TCN_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?{~}(^)[_]@#$,./&-*++=";
const DROP_AND_PROMOTION_PIECES = "qnrbkp";
const FILES = "abcdefgh";

export interface OpeningMove {
  token: string;
  from: string | null;
  to: string;
  drop: string | null;
  promotion: string | null;
  label: string;
}

export interface OpeningPosition {
  fen: string;
  moves: OpeningMove[];
  lastMove: { from: string | null; to: string } | null;
}

interface DecodedMove {
  from?: string;
  to: string;
  drop?: string;
  promotion?: string;
}

function square(index: number): string {
  return `${FILES[index % 8]}${Math.floor(index / 8) + 1}`;
}

function decodeToken(token: string): DecodedMove {
  if (token.length !== 2) throw new Error(`Invalid TCN token: ${token}`);
  const sourceIndex = TCN_ALPHABET.indexOf(token[0]);
  let targetIndex = TCN_ALPHABET.indexOf(token[1]);
  if (sourceIndex < 0 || targetIndex < 0) throw new Error(`Unknown TCN token: ${token}`);
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

function startingBoard(): Map<string, string> {
  const board = new Map<string, string>();
  const ranks = ["rnbqkbnr", "pppppppp", "", "", "", "", "PPPPPPPP", "RNBQKBNR"];
  ranks.forEach((pieces, rankIndex) => {
    const rank = 8 - rankIndex;
    [...pieces].forEach((piece, fileIndex) => board.set(`${FILES[fileIndex]}${rank}`, piece));
  });
  return board;
}

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

function moveLabel(board: Map<string, string>, move: DecodedMove): string {
  if (move.drop) return `${move.drop.toUpperCase()}@${move.to}`;
  const from = move.from as string;
  const piece = board.get(from);
  if (!piece) throw new Error(`TCN move starts on an empty square: ${from}${move.to}`);
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
      board.set(decoded.to, whiteToMove ? decoded.drop.toUpperCase() : decoded.drop.toLowerCase());
      enPassant = null;
    } else {
      const from = decoded.from as string;
      let piece = board.get(from);
      if (!piece) throw new Error(`TCN move starts on an empty square: ${from}${decoded.to}`);
      board.delete(from);
      const pawn = piece.toUpperCase() === "P";
      if (pawn && from[0] !== decoded.to[0] && !board.has(decoded.to) && decoded.to === enPassant) {
        board.delete(`${decoded.to[0]}${from[1]}`);
      }
      if (piece.toUpperCase() === "K" && Math.abs(FILES.indexOf(from[0]) - FILES.indexOf(decoded.to[0])) === 2) {
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
        piece = whiteToMove ? decoded.promotion.toUpperCase() : decoded.promotion.toLowerCase();
      }
      for (const touched of [from, decoded.to]) {
        if (touched === "e1") { castling.delete("K"); castling.delete("Q"); }
        if (touched === "e8") { castling.delete("k"); castling.delete("q"); }
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
    lastMove: moves.length ? { from: moves.at(-1)?.from ?? null, to: moves.at(-1)?.to as string } : null,
  };
}
