import { createElement } from "react";
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { previewParams, previewPosition } from "@/app/utils/social-preview/position";
import { loadPreview } from "@/app/utils/social-preview/loadPreview.server";
import { PreviewImage } from "@/app/utils/social-preview/PreviewImage";

async function fallback() {
  return new Response(await readFile(path.join(process.cwd(), "public/og-image.png")), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=60" },
  });
}

/** Locally bundled viewer artwork keeps image generation independent of asset hosts. */
async function loadSprites() {
  const entries = await Promise.all(["w", "b"].flatMap(color => ["P", "N", "B", "R", "Q", "K"].map(async piece => {
    const code = `${color}${piece}`;
    const data = await readFile(path.join(process.cwd(), "public/preview-pieces", `${code}.png`));
    return [code, `data:image/png;base64,${data.toString("base64")}`];
  })));
  return Object.fromEntries(entries) as Record<string, string>;
}

export async function GET(request: Request) {
  const params = previewParams(new URL(request.url).searchParams);
  if (!params) return fallback();
  try {
    const source = params.has("sharedId") ? "sharedId" : "gameId";
    const game = await loadPreview(source, params.get(source)!);
    if (!game) return fallback();
    const ply = params.has("ply") ? Number(params.get("ply")) : null;
    const { state, appliedPly } = previewPosition(game.original, game.partner, ply);
    const caption = `${game.match ? "Match · Game 1 · " : ""}${ply === null ? "Final position" : `Position after ${appliedPly} moves`}`;
    const response = new ImageResponse(createElement(PreviewImage, { state, caption, sprites: await loadSprites() }), { width: 1200, height: 630 });
    // Buffer the render so failures also return the branded fallback instead of a broken stream.
    return new Response(await response.arrayBuffer(), { headers: {
      "Content-Type": "image/png", "Cache-Control": "public, max-age=300, s-maxage=3600",
    } });
  } catch (error) {
    console.error("[social-preview] Unable to render preview", error instanceof Error ? error.message : "Unknown error");
    return fallback();
  }
}
