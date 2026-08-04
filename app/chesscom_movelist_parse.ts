/**
 * chess.com compressed movelist decoder.
 *
 * chess.com stores each game's move history as a dense two-character-per-move string.
 * Symbols encode source/target squares, drops, promotions, castling, and en passant.
 * This module replays those pairs on a virtual board to emit SAN-like strings the
 * rest of the app (replay, analysis loading, move ordering) can consume.
 *
 * Adapted from the legacy bughouse-viewer implementation; behavior must remain
 * byte-compatible with chess.com payloads.
 */

/**
 * Parse a chess.com compressed move list into an ordered array of move strings.
 *
 * @param raw - The raw `moveList` field from a chess.com live-game payload.
 * @returns SAN-ish move strings including bughouse drops (`P@e4`) and promotions.
 */
export function parseChessComCompressedMoveList(raw: string): string[] {
    const encodedPairs: string[] = [];
    for (let i = 0; i < raw.length; i += 2) {
        encodedPairs.push(raw.substring(i, i + 2));
    }

    /**
     * Virtual board state keyed by algebraic square.
     * Uppercase = white piece, lowercase = black piece, "." = empty.
     */
    const board: Record<string, string> = {
        "a8": "r",
        "b8": "n",
        "c8": "b",
        "d8": "q",
        "e8": "k",
        "f8": "b",
        "g8": "n",
        "h8": "r",
        "a7": "p",
        "b7": "p",
        "c7": "p",
        "d7": "p",
        "e7": "p",
        "f7": "p",
        "g7": "p",
        "h7": "p",
        "a6": ".",
        "b6": ".",
        "c6": ".",
        "d6": ".",
        "e6": ".",
        "f6": ".",
        "g6": ".",
        "h6": ".",
        "a5": ".",
        "b5": ".",
        "c5": ".",
        "d5": ".",
        "e5": ".",
        "f5": ".",
        "g5": ".",
        "h5": ".",
        "a4": ".",
        "b4": ".",
        "c4": ".",
        "d4": ".",
        "e4": ".",
        "f4": ".",
        "g4": ".",
        "h4": ".",
        "a3": ".",
        "b3": ".",
        "c3": ".",
        "d3": ".",
        "e3": ".",
        "f3": ".",
        "g3": ".",
        "h3": ".",
        "a2": "P",
        "b2": "P",
        "c2": "P",
        "d2": "P",
        "e2": "P",
        "f2": "P",
        "g2": "P",
        "h2": "P",
        "a1": "R",
        "b1": "N",
        "c1": "B",
        "d1": "Q",
        "e1": "K",
        "f1": "B",
        "g1": "N",
        "h1": "R",
    };

    const moves: string[] = [];

    /**
     * Map a single chess.com encoding symbol to an algebraic square (e.g. `"e4"`).
     * Returns undefined when the symbol is not in the known alphabet.
     */
    function toSquare(symbol: string) {
        const squareMap = {
            "4": "a8",
            "5": "b8",
            "6": "c8",
            "7": "d8",
            "8": "e8",
            "9": "f8",
            "!": "g8",
            "?": "h8",
            "W": "a7",
            "X": "b7",
            "Y": "c7",
            "Z": "d7",
            "0": "e7",
            "1": "f7",
            "2": "g7",
            "3": "h7",
            "O": "a6",
            "P": "b6",
            "Q": "c6",
            "R": "d6",
            "S": "e6",
            "T": "f6",
            "U": "g6",
            "V": "h6",
            "G": "a5",
            "H": "b5",
            "I": "c5",
            "J": "d5",
            "K": "e5",
            "L": "f5",
            "M": "g5",
            "N": "h5",
            "y": "a4",
            "z": "b4",
            "A": "c4",
            "B": "d4",
            "C": "e4",
            "D": "f4",
            "E": "g4",
            "F": "h4",
            "q": "a3",
            "r": "b3",
            "s": "c3",
            "t": "d3",
            "u": "e3",
            "v": "f3",
            "w": "g3",
            "x": "h3",
            "i": "a2",
            "j": "b2",
            "k": "c2",
            "l": "d2",
            "m": "e2",
            "n": "f2",
            "o": "g2",
            "p": "h2",
            "a": "a1",
            "b": "b1",
            "c": "c1",
            "d": "d1",
            "e": "e1",
            "f": "f1",
            "g": "g1",
            "h": "h1",
        } as const;
        const result = squareMap[symbol as keyof typeof squareMap];
        return result;
    }

    // Main parsing loop: each pair is (sourceSymbol, targetSymbol).
    for (let i = 0; i < encodedPairs.length; i++) {
        const sourceSymbol = encodedPairs[i][0];
        const targetSymbol = encodedPairs[i][1];

        // --- Bughouse drops: source symbol selects piece type, target is square ---
        if ("&-*+=".includes(sourceSymbol)) {
            const piece = "QNRBP"["&-*+=".indexOf(sourceSymbol)];
            board[toSquare(targetSymbol)] = piece;
            moves.push(piece + "@" + toSquare(targetSymbol));
            continue;
        }

        // --- Pawn promotions: target symbol encodes piece + file adjustment ---
        if ("{~}(^)[_]@#$".includes(targetSymbol)) {
            const promoteTo =
                "qnrb"[Math.floor("{~}(^)[_]@#$".indexOf(targetSymbol) / 3)];
            const fileChange = ("{~}(^)[_]@#$".indexOf(targetSymbol) % 3) - 1;
            const newRank = (toSquare(sourceSymbol)[1] === "7") ? 8 : 1;
            const newFile = String.fromCharCode(
                toSquare(sourceSymbol).charCodeAt(0) + fileChange,
            );
            const promotionTarget = newFile + newRank;
            board[toSquare(sourceSymbol)] = ".";
            board[promotionTarget] = promoteTo.toUpperCase();

            if (toSquare(sourceSymbol)[0] !== newFile) {
                moves.push(
                    toSquare(sourceSymbol)[0] + "x" + promotionTarget + "=" +
                        promoteTo.toUpperCase(),
                );
            } else {
                moves.push(promotionTarget + "=" + promoteTo.toUpperCase());
            }
            continue;
        }

        // --- Castling: king source + king target on e-file ---
        if ("kK".includes(board[toSquare(sourceSymbol)])) {
            const kingMove = toSquare(sourceSymbol) + toSquare(targetSymbol);
            let isCastle = false;

            if (kingMove === "e1g1") {
                moves.push("O-O");
                board["h1"] = ".";
                board["f1"] = "R";
                isCastle = true;
            } else if (kingMove === "e8g8") {
                moves.push("O-O");
                board["h8"] = ".";
                board["f8"] = "r";
                isCastle = true;
            } else if (kingMove === "e1c1") {
                moves.push("O-O-O");
                board["a1"] = ".";
                board["d1"] = "R";
                isCastle = true;
            } else if (kingMove === "e8c8") {
                moves.push("O-O-O");
                board["a8"] = ".";
                board["d8"] = "r";
                isCastle = true;
            }

            if (isCastle) {
                board[toSquare(targetSymbol)] = board[toSquare(sourceSymbol)];
                board[toSquare(sourceSymbol)] = ".";
                continue;
            }
            // Non-castling king moves fall through to regular move handling.
        }

        // --- En passant: pawn moves diagonally to an empty square ---
        if ("pP".includes(board[toSquare(sourceSymbol)])) {
            const isDiagonal = toSquare(sourceSymbol)[0] !== toSquare(targetSymbol)[0];
            const isEmptyTarget = board[toSquare(targetSymbol)] === ".";

            if (isDiagonal && isEmptyTarget) {
                if (toSquare(targetSymbol)[1] === "6") {
                    const capturedSq = toSquare(targetSymbol)[0] + "5";
                    board[capturedSq] = ".";
                } else if (toSquare(targetSymbol)[1] === "3") {
                    const capturedSq = toSquare(targetSymbol)[0] + "4";
                    board[capturedSq] = ".";
                }

                board[toSquare(targetSymbol)] = board[toSquare(sourceSymbol)];
                board[toSquare(sourceSymbol)] = ".";
                moves.push(toSquare(sourceSymbol)[0] + "x" + toSquare(targetSymbol));
                continue;
            }
        }

        // --- Regular moves and captures ---
        const isCapture = board[toSquare(targetSymbol)] !== ".";
        board[toSquare(targetSymbol)] = board[toSquare(sourceSymbol)];
        board[toSquare(sourceSymbol)] = ".";

        if (board[toSquare(targetSymbol)].toLowerCase() === "p") {
            if (isCapture) {
                moves.push(toSquare(sourceSymbol)[0] + "x" + toSquare(targetSymbol));
            } else {
                moves.push(toSquare(targetSymbol));
            }
        } else {
            moves.push(
                board[toSquare(targetSymbol)].toUpperCase() + toSquare(sourceSymbol) + (isCapture ? "x" : "") +
                    toSquare(targetSymbol),
            );
        }
    }

    return moves;
}
