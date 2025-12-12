/**
 * Parse chess.com compressed move list into SAN-like strings the rest of the app can consume.
 * The string encodes source/target in two-character chunks with custom drop/promotion symbols.
 * This function replays moves on a virtual board to emit readable move strings.
 */
export function parseChessComCompressedMoveList(raw: string): string[] {
    const encodedPairs: string[] = [];
    for (let i = 0; i < raw.length; i += 2) {
        encodedPairs.push(raw.substring(i, i + 2));
    }

    // Track the current board state
    // Note: The mapping here tracks piece TYPES on squares.
    // Uppercase = White, Lowercase = Black?
    // Based on initialization: "a8": "r" (Black rook), "a1": "R" (White rook). Yes.
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
        return squareMap[symbol as keyof typeof squareMap];
    }

    // Main parsing loop
    for (let i = 0; i < encodedPairs.length; i++) {
        const sourceSymbol = encodedPairs[i][0];
        const targetSymbol = encodedPairs[i][1];

        // Handle drops (bughouse pieces arriving from reserve).
        // Remaining logic handles promotions, castling, en passant, and captures.
        // Drops
        if ("&-*+=".includes(sourceSymbol)) {
            const piece = "QNRBP"["&-*+=".indexOf(sourceSymbol)];
            board[toSquare(targetSymbol)] = piece;
            moves.push(piece + "@" + toSquare(targetSymbol));
            continue;
        }

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

        if ("kK".includes(board[toSquare(sourceSymbol)])) {
            // Handling castles
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
            // If it's a king move but not castling, fall through to regular move logic
        }

        // Check for En Passant
        // Legacy: pawn moves diagonally to empty square
        if ("pP".includes(board[toSquare(sourceSymbol)])) {
            const isDiagonal = toSquare(sourceSymbol)[0] !== toSquare(targetSymbol)[0];
            const isEmptyTarget = board[toSquare(targetSymbol)] === ".";

            if (isDiagonal && isEmptyTarget) {
                // En Passant detected
                // Clean the captured pawn
                if (toSquare(targetSymbol)[1] === "6") {
                    // White capturing en passant on rank 6, pawn is on rank 5
                    const capturedSq = toSquare(targetSymbol)[0] + "5";
                    board[capturedSq] = ".";
                } else if (toSquare(targetSymbol)[1] === "3") {
                    // Black capturing en passant on rank 3, pawn is on rank 4
                    const capturedSq = toSquare(targetSymbol)[0] + "4";
                    board[capturedSq] = ".";
                }

                board[toSquare(targetSymbol)] = board[toSquare(sourceSymbol)];
                board[toSquare(sourceSymbol)] = ".";
                moves.push(toSquare(sourceSymbol)[0] + "x" + toSquare(targetSymbol));
                continue;
            }
        }

        // Handling regular moves and captures
        const isCapture = board[toSquare(targetSymbol)] !== ".";
        board[toSquare(targetSymbol)] = board[toSquare(sourceSymbol)];
        board[toSquare(sourceSymbol)] = ".";

        // Check if source piece was a king and update tracking
        if (board[toSquare(targetSymbol)].toLowerCase() === "p") {
            // Pawn move
            if (isCapture) {
                moves.push(toSquare(sourceSymbol)[0] + "x" + toSquare(targetSymbol));
            } else {
                moves.push(toSquare(targetSymbol));
            }
        } else {
            // Piece move
            moves.push(
                board[toSquare(targetSymbol)].toUpperCase() + toSquare(sourceSymbol) + (isCapture ? "x" : "") +
                    toSquare(targetSymbol),
            );
        }
    }

    return moves;
}
