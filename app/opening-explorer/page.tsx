import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import OpeningExplorerPageClient from "../components/opening-explorer/OpeningExplorerPageClient";
import { openingExplorerEnabledForServerRequest } from "../components/opening-explorer/featureFlag";

export async function OpeningExplorerGate() {
  const requestHeaders = await headers();
  if (!openingExplorerEnabledForServerRequest(requestHeaders.get("host") ?? undefined)) notFound();
  return <OpeningExplorerPageClient />;
}

export default function OpeningExplorerPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center bg-slate-950 text-slate-200">Loading opening explorer…</div>}>
      <OpeningExplorerGate />
    </Suspense>
  );
}
