/**
 * @module app/page
 *
 * Application entry route (`/`). The home page is intentionally thin: it wraps
 * {@link GameViewerPage} in React Suspense so URL-driven game loading can suspend
 * without blocking the root layout shell.
 */
import { Suspense } from "react";
import CenteredLoadingSpinner from "./components/ui/CenteredLoadingSpinner";
import GameViewerPage from "./components/viewer/GameViewerPage";
import type { Metadata } from "next";
import { previewParams } from "./utils/social-preview/position";

/** Query-specific cards must be in server metadata so link crawlers can discover them. */
export async function generateMetadata({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value) && value[0]) query.set(key, value[0]);
  }
  const params = previewParams(query);
  if (!params) return {};
  const url = `/?${params}`;
  const image = `/api/social-preview?${params}`;
  const title = "Bughouse game | Relay";
  const description = params.has("ply")
    ? "Explore this position on both bughouse boards in Relay."
    : "Replay this bughouse game or match in Relay.";
  return {
    alternates: { canonical: url },
    openGraph: {
      type: "website", siteName: "Relay", title, description, url,
      images: [{ url: image, width: 1200, height: 630, type: "image/png", alt: "Two bughouse boards at the shared position" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/**
 * Landing page that hosts the bughouse game viewer with a suspense fallback.
 */
export default function Home() {
  return (
    <Suspense
      fallback={
        <CenteredLoadingSpinner label="Loading viewer..." />
      }
    >
      <GameViewerPage />
    </Suspense>
  );
}
