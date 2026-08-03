export interface OpeningExplorerEnvironment {
  nodeEnv: string | undefined;
  localFlag?: string;
  previewFlag?: string;
  previewHosts?: string;
  productionFlag?: string;
  productionHosts?: string;
  requestHost?: string;
  vercelEnvironment?: string;
}

export type OpeningExplorerHostedEnvironment = Pick<
  OpeningExplorerEnvironment,
  | "previewFlag"
  | "previewHosts"
  | "productionFlag"
  | "productionHosts"
  | "vercelEnvironment"
>;

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

function normalizedHostname(host: string | undefined): string | null {
  if (!host) return null;
  try {
    return new URL(`http://${host}`).hostname.toLocaleLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

function configuredPreviewHosts(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((host) => normalizedHostname(host.trim()))
      .filter((host): host is string => host !== null),
  );
}

export function openingExplorerEnabled(environment: OpeningExplorerEnvironment): boolean {
  if (environment.nodeEnv !== "production") {
    const requestHost = normalizedHostname(environment.requestHost);
    return environment.localFlag === "true"
      && requestHost !== null
      && LOCAL_HOSTS.has(requestHost);
  }

  const requestHost = normalizedHostname(environment.requestHost);
  if (requestHost === null) return false;
  if (environment.vercelEnvironment === "preview") {
    return environment.previewFlag === "true"
      && configuredPreviewHosts(environment.previewHosts).has(requestHost);
  }
  if (environment.vercelEnvironment === "production") {
    return environment.productionFlag === "true"
      && configuredPreviewHosts(environment.productionHosts).has(requestHost);
  }
  return false;
}

export function openingExplorerHostedEnvironment(): OpeningExplorerHostedEnvironment {
  return {
    previewFlag: process.env.OPENING_EXPLORER_PREVIEW_ENABLED,
    previewHosts: process.env.OPENING_EXPLORER_PREVIEW_HOSTS,
    productionFlag: process.env.OPENING_EXPLORER_PRODUCTION_ENABLED,
    productionHosts: process.env.OPENING_EXPLORER_PRODUCTION_HOSTS,
    vercelEnvironment: process.env.VERCEL_ENV,
  };
}

export function openingExplorerEnabledForServerRequest(requestHost: string | undefined): boolean {
  return openingExplorerEnabled({
    localFlag: process.env.NEXT_PUBLIC_ENABLE_OPENING_EXPLORER,
    nodeEnv: process.env.NODE_ENV,
    ...openingExplorerHostedEnvironment(),
    requestHost,
  });
}
