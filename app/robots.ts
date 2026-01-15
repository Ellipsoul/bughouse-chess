import type { MetadataRoute } from "next";
import { siteUrl } from "./utils/siteMetadata";

/**
 * Robots policy for public crawling and sitemap discovery.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
