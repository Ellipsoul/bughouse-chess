/**
 * Resolve the canonical site URL used for SEO metadata and static routes.
 * Prefers NEXT_PUBLIC_SITE_URL, then VERCEL_URL, then a localhost fallback.
 */
const rawSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

/**
 * Normalized, absolute site URL with any trailing slash removed.
 */
export const siteUrl = rawSiteUrl.replace(/\/+$/, "");

/**
 * Base URL for Next.js metadata to resolve relative URLs.
 */
export const metadataBase = new URL(siteUrl);
