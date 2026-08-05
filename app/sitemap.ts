/**
 * @module app/sitemap
 *
 * Static sitemap generation for publicly indexable routes. Dynamic viewer URLs
 * (per-game `?gameid=` links) are intentionally excluded because they are unbounded.
 */
import type { MetadataRoute } from "next";
import { siteUrl } from "./utils/platform/siteMetadata";

/** Routes that should appear in `sitemap.xml` for crawlers. */
const publicRoutes = [
  "/",
  "/player-insights",
  "/shared-games",
];

/**
 * Basic sitemap for publicly indexable pages.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified,
    changeFrequency: "weekly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
