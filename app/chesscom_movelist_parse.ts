// This module parses a compressed chess movelist from Chess.com into
// a Bughouse-compatible PGN move list.

export function parseChessComCompressedMoveList(s: string): string[] {
    // Split the string into an array by 2 characters
    const moves_by_two = [];
    for (let i = 0; i < s.length; i += 2) {
        moves_by_two.push(s.substring(i, i + 2));
    }

    // Track the current board state
    const brd = {
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
            const newRank = (sq(so)[1] === 7) ? 8 : 1;
            const newFile = String.fromCharCode(
                sq(so).charCodeAt(0) + fileChange,
            );
            const promotionTarget = newFile + newRank;
            brd[so] = ".";
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

            if (kingMove === "e1g1" || kingMove === "e8g8") {
                mv.push("O-O");
            }
            if (kingMove === "e1c1" || kingMove === "e8c8") {
                mv.push("O-O-O");
            }

            brd[sq(ta)] = brd[sq(so)];
            brd[sq(so)] = ".";
            continue;
        }

        // Handling regular moves and captures
        const isCapture = brd[sq(ta)] !== ".";
        brd[sq(ta)] = brd[sq(so)];
        brd[sq(so)] = ".";

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
