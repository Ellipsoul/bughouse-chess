import { headers } from "next/headers";
import { openingExplorerEnabledForServerRequest } from "./featureFlag";
import { OpeningExplorerSidebarLink } from "./OpeningExplorerSidebarLink";

export async function OpeningExplorerSidebarGate() {
  const requestHeaders = await headers();
  if (!openingExplorerEnabledForServerRequest(requestHeaders.get("host") ?? undefined)) return null;
  return <OpeningExplorerSidebarLink />;
}
