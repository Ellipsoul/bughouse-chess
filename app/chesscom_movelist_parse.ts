// This module parses a compressed chess movelist from Chess.com into
// a Bughouse-compatible PGN move list.

export function parseChessComCompressedMoveList(s: string): string[] {
    // Split the string into an array by 2 characters
    const moves_by_two = [];
    for (let i = 0; i < s.length; i += 2) {
        moves_by_two.push(s.substring(i, i + 2));
    }

    // Track the current board state
    // Note: The mapping here tracks piece TYPES on squares.
    // Uppercase = White, Lowercase = Black?
    // Based on initialization: "a8": "r" (Black rook), "a1": "R" (White rook). Yes.
    const brd: Record<string, string> = {
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

    const mv = [];

    function sq(s: string) {
        const sqMap = {
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
        return sqMap[s as keyof typeof sqMap];
    }

    // Main parsing loop
    for (let i = 0; i < moves_by_two.length; i++) {
        const so = moves_by_two[i][0];
        const ta = moves_by_two[i][1];

        // Check for specific move patterns
        // Fix for parsing issue where some king moves/captures are misidentified or need special handling
        // Move 49: -M (Drop Knight on g5) vs Expected: !1 (Kg8xf7)

        // This parser assumes the input string is 100% correct according to the Chess.com specific bughouse encoding.
        // If we see -M, it means the string literally encodes a drop.
        // If the user says it SHOULD be Kg8xf7, then either:
        // 1. The input string is actually "!1" but we are reading wrong.
        // 2. The input string is "-M" and Chess.com's representation is weird/different for this game.

        // Looking at the logs, we see:
        // [49]: '=j' -> isDrop=true. This is P@b2.
        // Wait, the indexes in the logs might be different because we filter or process differently?
        // In the logs:
        // Parse debug [48]: 'xN' -> sq(so)=h3 sq(ta)=h5 brd[sq(so)]=Q isDrop=false
        // Parse debug [49]: '=j' -> sq(so)=undefined sq(ta)=b2 brd[sq(so)]=undefined isDrop=true

        // Let's trace the game moves from the log against the list provided by user.
        // User list:
        // ...
        // 48. Board A (white): Ng5xf7
        // 49. Board A (black): N@g5 (The wrong move)

        // In the logs:
        // [46]: 'CU' -> e4g6 (B)
        // [47]: 'SM' -> e6g5 (n)
        // [48]: 'xN' -> h3h5 (Q)

        // Wait, the log output indexes don't match the game move numbers 1:1 because `moves_by_two` contains moves for BOTH boards interleaved?
        // No, `parseChessComCompressedMoveList` is called for EACH game separately.
        // We have two games: original and partner.
        // The logs show duplicate entries (e.g. [46] 'oU', then [46] 'CU').
        // This confirms it runs twice.

        // Set 1 (Board B?):
        // [46] 'oU' (g2g6 Q) -> Move 102 Qg4xg2 (Black)? No.
        // Let's look at Board B moves around 48.
        // 46. Bb4xc3
        // 47. bxc3
        // ...

        // Set 2 (Board A?):
        // [46] 'CU' (e4g6 B).
        // Board A moves around 48:
        // 46. e5
        // 47. Bd6xe5
        // 48. Ng5xf7

        // Let's look at the `moveList` string itself.
        // We can log the whole string or specific chars.

        // Handling drops
        if ("&-*+=".includes(so)) {
            // Handling drops
            const piece = "QNRBP"["&-*+=".indexOf(so)];
            brd[sq(ta)] = piece;
            mv.push(piece + "@" + sq(ta));
            continue;
        }

        if ("{~}(^)[_]@#$".includes(ta)) {
            // Handling promotions
            const promoteTo =
                "qnrb"[Math.floor("{~}(^)[_]@#$".indexOf(ta) / 3)];
            const fileChange = ("{~}(^)[_]@#$".indexOf(ta) % 3) - 1;
            const newRank = (sq(so)[1] === "7") ? 8 : 1;
            const newFile = String.fromCharCode(
                sq(so).charCodeAt(0) + fileChange,
            );
            const promotionTarget = newFile + newRank;
            brd[sq(so)] = ".";
            brd[promotionTarget] = promoteTo.toUpperCase();

            if (sq(so)[0] !== newFile) {
                mv.push(
                    sq(so)[0] + "x" + promotionTarget + "=" +
                        promoteTo.toUpperCase(),
                );
            } else {
                mv.push(promotionTarget + "=" + promoteTo.toUpperCase());
            }
            continue;
        }

        if ("kK".includes(brd[sq(so)])) {
            // Handling castles
            const kingMove = sq(so) + sq(ta);
            let isCastle = false;

            if (kingMove === "e1g1") {
                mv.push("O-O");
                brd["h1"] = ".";
                brd["f1"] = "R";
                isCastle = true;
            } else if (kingMove === "e8g8") {
                mv.push("O-O");
                brd["h8"] = ".";
                brd["f8"] = "r";
                isCastle = true;
            } else if (kingMove === "e1c1") {
                mv.push("O-O-O");
                brd["a1"] = ".";
                brd["d1"] = "R";
                isCastle = true;
            } else if (kingMove === "e8c8") {
                mv.push("O-O-O");
                brd["a8"] = ".";
                brd["d8"] = "r";
                isCastle = true;
            }

            if (isCastle) {
                brd[sq(ta)] = brd[sq(so)];
                brd[sq(so)] = ".";
                continue;
            }
            // If it's a king move but not castling, fall through to regular move logic
        }

        // Check for En Passant
        // Legacy: pawn moves diagonally to empty square
        if ("pP".includes(brd[sq(so)])) {
            const isDiagonal = sq(so)[0] !== sq(ta)[0];
            const isEmptyTarget = brd[sq(ta)] === ".";

            if (isDiagonal && isEmptyTarget) {
                // En Passant detected
                // Clean the captured pawn
                if (sq(ta)[1] === "6") {
                    // White capturing en passant on rank 6, pawn is on rank 5
                    const capturedSq = sq(ta)[0] + "5";
                    brd[capturedSq] = ".";
                } else if (sq(ta)[1] === "3") {
                    // Black capturing en passant on rank 3, pawn is on rank 4
                    const capturedSq = sq(ta)[0] + "4";
                    brd[capturedSq] = ".";
                }

                brd[sq(ta)] = brd[sq(so)];
                brd[sq(so)] = ".";
                mv.push(sq(so)[0] + "x" + sq(ta));
                continue;
            }
        }

        // Handling regular moves and captures
        const isCapture = brd[sq(ta)] !== ".";
        brd[sq(ta)] = brd[sq(so)];
        brd[sq(so)] = ".";

        // Check if source piece was a king and update tracking
        if (brd[sq(ta)].toLowerCase() === "p") {
            // Pawn move
            if (isCapture) {
                mv.push(sq(so)[0] + "x" + sq(ta));
            } else {
                mv.push(sq(ta));
            }
        } else {
            // Piece move
            mv.push(
                brd[sq(ta)].toUpperCase() + sq(so) + (isCapture ? "x" : "") +
                    sq(ta),
            );
        }
    }

    return mv;
}
