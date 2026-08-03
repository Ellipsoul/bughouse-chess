import { Suspense } from "react";
import { notFound } from "next/navigation";
import OpeningExplorerPageClient from "../components/opening-explorer/OpeningExplorerPageClient";
import { OPENING_EXPLORER_ENABLED } from "../components/opening-explorer/featureFlag";

export default function OpeningExplorerPage() {
  if (!OPENING_EXPLORER_ENABLED) notFound();
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center bg-slate-950 text-slate-200">Loading opening explorer…</div>}>
      <OpeningExplorerPageClient />
    </Suspense>
  );
}
