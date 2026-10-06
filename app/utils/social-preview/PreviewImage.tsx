/* eslint-disable @next/next/no-img-element -- ImageResponse renders images directly, without next/image. */
import { Chess } from "chess.js";
import type { BughouseGameState } from "@/app/types/bughouse";

/**
 * Render one board using ImageResponse-compatible flex styles and supplied data-URL sprites.
 */
function Board({ fen, flipped, top, bottom, sprites }: {
  fen: string; flipped: boolean; top: string; bottom: string; sprites: Record<string, string>;
}) {
  const squares = new Chess(fen).board().flat();
  if (flipped) squares.reverse();
  return <div style={{ display: "flex", flexDirection: "column", width: 480 }}>
    <div style={{ display: "flex", height: 38, fontSize: 23 }}>{top.slice(0, 32)}</div>
    <div style={{ display: "flex", flexWrap: "wrap", width: 448, height: 448 }}>
      {squares.map((piece, i) => <div key={i} style={{ display: "flex", width: 56, height: 56, background: (Math.floor(i / 8) + i % 8) % 2 ? "#b58863" : "#f0d9b5" }}>
        {piece ? <img alt="" width={56} height={56} src={sprites[`${piece.color}${piece.type.toUpperCase()}`]} /> : null}
      </div>)}
    </div>
    <div style={{ display: "flex", height: 38, paddingTop: 8, fontSize: 23 }}>{bottom.slice(0, 32)}</div>
  </div>;
}

/**
 * Compose both logical boards with A White and B Black at the bottom.
 * The static preview does not carry the viewer's temporary flip/swap state.
 */
export function PreviewImage({ state, caption, sprites }: { state: BughouseGameState; caption: string; sprites: Record<string, string> }) {
  return <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#142c3c", color: "#f5f7fa", padding: "24px 64px", fontFamily: "sans-serif" }}>
    <div style={{ display: "flex", justifyContent: "space-between", height: 54, alignItems: "center", marginBottom: 12 }}>
      <div style={{ display: "flex", fontSize: 36, fontWeight: 700 }}>RELAY</div>
      <div style={{ display: "flex", fontSize: 24, color: "#c2d3df" }}>{caption}</div>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <Board fen={state.boardA.fen} flipped={false} top={state.players.aBlack.username} bottom={state.players.aWhite.username} sprites={sprites} />
      <Board fen={state.boardB.fen} flipped top={state.players.bWhite.username} bottom={state.players.bBlack.username} sprites={sprites} />
    </div>
  </div>;
}
