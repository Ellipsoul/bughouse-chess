import type { MetadataRoute } from "next";
import { siteUrl } from "./utils/siteMetadata";

const publicRoutes = [
  "/",
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
