/**
 * @module opening-explorer/page
 *
 * Server entry for the opening-explorer experiment route.
 *
 * Wraps the client page in `Suspense` because the client reads `useSearchParams`
 * for deep links (`?node=` / `?dataset=`). The route is always available; a
 * missing upstream reader surfaces as a bounded unavailable state inside the
 * client rather than hiding the page behind a feature flag.
 */

import { Suspense } from "react";
import OpeningExplorerPageClient from "../components/opening-explorer/OpeningExplorerPageClient";

/**
 * Renders the opening explorer behind a Suspense boundary for search-param hydration.
 */
export default function OpeningExplorerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-slate-950 text-slate-200">
          Loading opening explorer…
        </div>
      }
    >
      <OpeningExplorerPageClient />
    </Suspense>
  );
}
