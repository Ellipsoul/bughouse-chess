// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { GET } from "@/app/api/social-preview/route";
import { loadPreview } from "@/app/utils/social-preview/loadPreview.server";
import original from "../../../fixtures/chesscom/160842423885.json";
import partner from "../../../fixtures/chesscom/160842423883.json";
import type { ChessGame } from "@/app/actions";

vi.mock("@/app/utils/social-preview/loadPreview.server", () => ({ loadPreview: vi.fn() }));
beforeEach(() => vi.mocked(loadPreview).mockReset());

it("renders a real 1200x630 PNG from a stored match's first game", async () => {
  vi.mocked(loadPreview).mockResolvedValue({ original: original as unknown as ChessGame, partner: partner as unknown as ChessGame, match: true });
  const result = await GET(new Request("https://example.com/api/social-preview?sharedId=example&ply=12"));
  const png = Buffer.from(await result.arrayBuffer());
  expect(loadPreview).toHaveBeenCalledWith("sharedId", "example");
  expect(result.headers.get("Content-Type")).toBe("image/png");
  expect(result.headers.get("Cache-Control")).toContain("s-maxage=3600");
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
  expect(png.equals(await readFile("public/og-image.png"))).toBe(false);
}, 15000);

it("returns the branded fallback without querying invalid sources", async () => {
  const result = await GET(new Request("https://example.com/api/social-preview?sharedId=../users"));
  expect(loadPreview).not.toHaveBeenCalled();
  expect(Buffer.from(await result.arrayBuffer())).toEqual(await readFile("public/og-image.png"));
});

it("returns the branded fallback when the source is unavailable", async () => {
  vi.mocked(loadPreview).mockResolvedValue(null);
  const result = await GET(new Request("https://example.com/api/social-preview?gameId=123"));
  expect(result.headers.get("Cache-Control")).toBe("public, max-age=60");
  expect(Buffer.from(await result.arrayBuffer())).toEqual(await readFile("public/og-image.png"));
});
