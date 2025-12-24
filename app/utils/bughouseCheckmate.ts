import { Chess, type Color, type Square } from "chess.js";

/**
 * Bughouse-aware checkmate detection.
 *
 * In bughouse, even if a position is a **regular chess** checkmate, the checked side may be
 * able to *drop* a piece to interpose (block) a sliding check (rook/bishop/queen).
 *
 * We therefore treat **bughouse checkmate** as a strict subset of chess checkmate:
 *
 * - Regular checkmate must hold (`board.isCheckmate()`).
 * - Additionally, the current check must be **unblockable by a drop**.
 *
 * Notes / invariants:
 * - This intentionally ignores whether the checked side currently has pieces in reserve.
 *   Even with an empty reserve, future captures on the *other* board could yield blockers.
 * - We do **not** use the "last moved piece" to determine the checker because bughouse (and chess)
 *   allows discovered checks. We use `board.attackers()` from the king square in the current position.
 * - `chess.js` uses the side-to-move as the "checked side" in checkmate positions, so we locate the
 *   king for `board.turn()`.
 */

/**
 * Return `true` iff the current position is a **bughouse checkmate**.
 */
export function isBughouseCheckmate(board: Chess): boolean {
  if (!board.isCheckmate()) return false;

  const checkedSide = board.turn();
  const kingSquare = findKingSquare(board, checkedSide);
  if (!kingSquare) {
    // Defensive: a well-formed position always has exactly one king per side.
    // If the position is malformed, prefer not claiming bughouse-mate.
    return false;
  }

  const attackerColor: Color = checkedSide === "w" ? "b" : "w";
  const attackers = board.attackers(kingSquare, attackerColor);
  if (attackers.length === 0) {
    // Defensive: checkmate implies check, but avoid false positives on corrupt state.
    return false;
  }

  // Double check cannot be blocked by interposition.
  if (attackers.length >= 2) return true;

  const attackerSquare = attackers[0] as Square;
  const attackerPiece = board.get(attackerSquare);
  if (!attackerPiece) return false;

  // Knight checks cannot be blocked.
  if (attackerPiece.type === "n") return true;

  // If there is any square strictly between attacker and king on a rook/bishop/queen ray,
  // then a drop can always interpose, so it is NOT a bughouse checkmate.
  //
  // Otherwise (adjacent checker, pawn/king check, etc.) there is no interposition square,
  // so the mate is bughouse-real.
  const between = squaresStrictlyBetweenOnRay(attackerSquare, kingSquare);
  return between.length === 0;
}

/**
 * Bughouse-aware suffix for display/notation.
 *
 * Important: This assumes the position is already in the "after move" state, where the side-to-move
 * is the opponent of the mover. That matches chess.js SAN semantics and how this codebase calls it.
 */
export function getBughouseCheckSuffix(board: Chess): "" | "+" | "#" {
  if (isBughouseCheckmate(board)) return "#";
  if (board.inCheck()) return "+";
  return "";
}

/**
 * Normalize a SAN-like string to ensure its trailing `+/#` matches bughouse semantics.
 *
 * This is needed because `chess.js` appends `#` for *regular chess* checkmate, but in bughouse many
 * such positions are blockable by a drop and should only be annotated as `+` (check), not `#`.
 */
export function normalizeSanSuffixForBughouse(params: { san: string; board: Chess }): string {
  const base = params.san.replace(/[+#]+$/, "");
  return `${base}${getBughouseCheckSuffix(params.board)}`;
}

function findKingSquare(board: Chess, color: Color): Square | null {
  // `findPiece` is a public API in chess.js@1.4.0.
  const squares = board.findPiece({ type: "k", color });
  if (squares.length !== 1) return null;
  return squares[0] as Square;
}

function squaresStrictlyBetweenOnRay(from: Square, to: Square): Square[] {
  const { file: fFile, rank: fRank } = squareToCoords(from);
  const { file: tFile, rank: tRank } = squareToCoords(to);

  const df = tFile - fFile;
  const dr = tRank - fRank;

  const stepFile = sign(df);
  const stepRank = sign(dr);

  // Must be aligned on a rook or bishop line.
  const isSameFile = df === 0 && dr !== 0;
  const isSameRank = dr === 0 && df !== 0;
  const isDiagonal = Math.abs(df) === Math.abs(dr) && df !== 0; // excludes same-square
  if (!isSameFile && !isSameRank && !isDiagonal) return [];

  const squares: Square[] = [];
  let curFile = fFile + stepFile;
  let curRank = fRank + stepRank;

  // Stop before `to` (strictly between).
  while (curFile !== tFile || curRank !== tRank) {
    const sq = coordsToSquare(curFile, curRank);
    // If next step would reach `to`, we should not include `to` itself.
    if (sq === to) break;
    squares.push(sq);
    curFile += stepFile;
    curRank += stepRank;
  }

  // If adjacent, loop never adds anything.
  return squares;
}

function squareToCoords(square: Square): { file: number; rank: number } {
  const fileChar = square[0];
  const rankChar = square[1];
  return { file: fileChar.charCodeAt(0) - "a".charCodeAt(0), rank: Number(rankChar) - 1 };
}

function coordsToSquare(file: number, rank: number): Square {
  const fileChar = String.fromCharCode("a".charCodeAt(0) + file);
  const rankChar = String(rank + 1);
  return `${fileChar}${rankChar}` as Square;
}

function sign(n: number): -1 | 0 | 1 {
  if (n === 0) return 0;
  return n > 0 ? 1 : -1;
}
