import "@testing-library/jest-dom/vitest";

/**
 * Shared test setup for Vitest.
 *
 * Notes:
 * - We run tests in `jsdom` so hooks/components can be tested via React Testing Library.
 * - Node 20+ provides `globalThis.crypto`, but we defensively polyfill it for test runners
 *   or environments where it may be missing.
 */
if (typeof globalThis.crypto === "undefined") {
  // Dynamic import for crypto polyfill in test environments
  const { webcrypto } = require("node:crypto") as typeof import("node:crypto");
  // @ts-expect-error - minimal polyfill for environments without global crypto
  globalThis.crypto = webcrypto;
}


