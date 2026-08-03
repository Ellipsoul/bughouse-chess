import { Suspense } from "react";
import OpeningExplorerPageClient from "../components/opening-explorer/OpeningExplorerPageClient";

export default function OpeningExplorerPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center bg-slate-950 text-slate-200">Loading opening explorer…</div>}>
      <OpeningExplorerPageClient />
    </Suspense>
  );
}
