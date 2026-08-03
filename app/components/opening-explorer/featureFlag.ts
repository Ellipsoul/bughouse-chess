export interface OpeningExplorerEnvironment {
  nodeEnv: string | undefined;
  publicFlag: string | undefined;
}

export function openingExplorerEnabled(environment: OpeningExplorerEnvironment): boolean {
  return environment.nodeEnv !== "production" && environment.publicFlag === "true";
}

export const OPENING_EXPLORER_ENABLED = openingExplorerEnabled({
  nodeEnv: process.env.NODE_ENV,
  publicFlag: process.env.NEXT_PUBLIC_ENABLE_OPENING_EXPLORER,
});
