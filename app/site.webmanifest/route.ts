import type { MetadataRoute } from "next";
import { shouldLockLandscapeForPhone } from "../utils/pwa/shouldLockLandscapeForPhone";

/**
 * Dynamic Web App Manifest.
 *
 * Why dynamic?
 * - The manifest spec doesn't allow per-device rules (e.g. "phones only").
 * - We can *approximate* "Android phone" via User-Agent and only then request `orientation: "landscape"`.
 *
 * Note: iOS generally does not respect the `orientation` manifest property for installed web apps, so this
 * primarily benefits Android/Chromium PWAs.
 */
export function GET(request: Request): Response {
  const userAgent = request.headers.get("user-agent");
  const lockLandscape = shouldLockLandscapeForPhone(userAgent);

  const manifest: MetadataRoute.Manifest & { orientation?: "any" | "natural" | "landscape" | "portrait" } =
    {
      name: "Relay - Bughouse Chess Analysis Tool",
      short_name: "Relay",
      start_url: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#ffffff",
      icons: [
        {
          src: "/android-chrome-192x192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/android-chrome-512x512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
      ...(lockLandscape ? { orientation: "landscape" as const } : {}),
    };

  return Response.json(manifest, {
    headers: {
      // Avoid CDN/shared caching across different device classes.
      "cache-control": "no-store",
      "content-type": "application/manifest+json; charset=utf-8",
    },
  });
}
