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
        // This is crucial because "kK" check above only handles castling logic
        // but we need to track king position even for normal moves
        // The `brd` object tracks piece types (k, q, r, etc.) at positions
        
        // Wait, the `brd` object is updated above: brd[sq(ta)] = brd[sq(so)].
        // The issue is likely that we aren't handling king moves that are NOT castling
        // specifically enough, or maybe the king moved and we didn't realize?
        // Actually, the logic seems fine for standard moves: piece at source moves to target.
        
        // Let's re-examine Black's move 49: N@g5. 
        // The user says "after move 48 (Ng5xf7), the correct move should be Kg8xf7".
        // If our parser outputs N@g5, that means the input string had a drop character or similar?
        // OR, the input string was for a king capture, but interpreted wrong?
        
        // Let's look at how king moves are handled.
        // If "kK".includes(brd[sq(so)]), we check for castling.
        // If it's NOT castling, we fall through to here.
        // Then we do:
        // brd[sq(ta)] = brd[sq(so)]; // Moves 'k' or 'K' to target
        // brd[sq(so)] = ".";
        
        // Then:
        // if (brd[sq(ta)].toLowerCase() === "p") { ... }
        // else {
        //    mv.push(brd[sq(ta)].toUpperCase() + sq(so) + (isCapture ? "x" : "") + sq(ta));
        // }
        
        // If Kg8xf7 happens:
        // so=g8 (has 'k'), ta=f7.
        // isCastle check: kingMove = "g8f7". Not e1g1 etc. Continue.
        // Fall through.
        // isCapture = true (if f7 had a piece, which it did: White's Knight from move 48 Ng5xf7).
        // brd[f7] = 'k'. brd[g8] = '.'.
        // piece is 'k'.
        // Output: K + g8 + x + f7 -> Kg8xf7.
        
        // So why did we get N@g5?
        // N@g5 implies a drop.
        // Drops are handled at the top: if ("&-*+=".includes(so)).
        // This means the input string `s` had a character from "&-*+=" at the start of the pair.
        
        // If the input string was actually a drop, then our parser is correct relative to the input string.
        // But the user says the move *should* be Kg8xf7.
        // This implies either:
        // 1. The input string `s` is WRONG / different from what we expect for that game.
        // 2. The input string `s` corresponds to Kg8xf7 but we are misinterpreting the characters.
        
        // In Chess.com compressed format:
        // regular moves: source char + target char.
        // drops: piece char (special) + target char.
        
        // If we parsed N@g5, `so` must have been in "&-*+=".
        // 'N' drop corresponds to '-'.
        // So the pair was "-M" (if M maps to g5).
        // M maps to g5? Let's check `sq` function.
        // "M": "g5". Yes.
        // So the input pair was "-M".
        
        // Why would the input be "-M" (Drop Knight on g5) if the move was Kg8xf7?
        // Maybe the move list string itself is shifted? 
        // If we missed a character or processed pairs incorrectly?
        // The loop is `i += 2`.
        
        // Let's check move 48: Ng5xf7.
        // White move.
        // Source: g5 (M). Target: f7 (1).
        // Pair: "M1".
        // brd[g5] must be 'N'.
        // brd[f7] becomes 'N'.
        
        // If the move list is just a long string, maybe we got out of sync?
        // But `moves_by_two` splits it evenly.
        
        // Let's assume the parser logic is generally correct (it matches the legacy one).
        // If we are getting N@g5, it's highly likely the compressed string actually says "-M".
        // If the real game move is Kg8xf7, then the compressed string SHOULD be:
        // Source g8 (!). Target f7 (1).
        // Pair: "!1".
        
        // If we are seeing "-M" instead of "!1", we are reading the wrong characters.
        // This usually happens if the string parsing got desynchronized (e.g. read 1 char instead of 2 for a previous move?).
        // But the loop is strict +2.
        
        // Is it possible the MoveList string we fetch from the API is different/wrong?
        // Or maybe we are parsing the 'partner' game's move list for this board?
        // Bughouse has 2 boards. 
        // Move 49 on Board A (Black).
        // Move 49 on Board B?
        
        // Let's look at the "Move Order by Timestamp" log from the user.
        // 48. Board A (white): Ng5xf7
        // 49. Board A (black): N@g5
        
        // Wait, look at move 49 in the user's log:
        // 49. Board A (black): N@g5 [21780.000s]
        
        // User says: "After knight takes f7 (move 48), the correct move that should be parsed is Kg8xf7".
        // So Board A White played Ng5xf7.
        // Board A Black (larso) should play Kg8xf7 (taking the knight back).
        // Instead, we see N@g5 (Drop Knight on g5).
        
        // If Black plays N@g5, they must have a Knight in reserve.
        // And g5 must be empty.
        // But White JUST moved a Knight to f7 from g5. So g5 IS empty.
        // So N@g5 is legal *if* Black has a knight.
        // But the user says it's wrong.
        
        // This implies the compressed string we have for Board A's move list contains the code for N@g5 ("-M") at that position.
        
        // Hypothesis: We are parsing the string correctly, but maybe we are misinterpreting a specific character mapping?
        // Or maybe the input string contains "special" sequences we don't handle?
        // Like {Time} or something inside the string?
        // No, `moveList` from API is usually just the characters.
        
        // Let's verify the character mapping for drops.
        // if ("&-*+=".includes(so))
        // piece = "QNRBP"["&-*+=".indexOf(so)]
        // & -> Q
        // - -> N
        // * -> R
        // + -> B
        // = -> P
        
        // Matches legacy `var drops = "&-*+=" // Q N R B P`.
        
        // Let's verify sq map.
        // ! -> g8. 1 -> f7.
        // If move was Kg8xf7, string should be "!1".
        
        // Is it possible that "!" is being interpreted as something else?
        // No, it's just a character.
        
        // What if the previous move parsing messed up the index?
        // We split by 2.
        
        // Let's look at the previous move (48): Ng5xf7.
        // White played.
        // Source g5 (M). Target f7 (1).
        // String: "M1".
        
        // Wait!
        // If the King captures, it is a regular move.
        // Check `sq` map for characters that might be special in Regex but not here.
        // `!` is fine.
        
        // Let's check `parseMoveList` in legacy `chesscom_movelist_parse.js`.
        // It has exact same logic.
        
        // Wait, could it be that `moveList` string contains something else?
        // The legacy code doesn't seem to strip anything.
        
        // Let's add some logging to the parser to see exactly what characters it's processing for that move.
        // That will confirm if we are receiving "-M" or "!1".
        
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
