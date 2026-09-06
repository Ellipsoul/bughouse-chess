import "@testing-library/jest-dom/vitest";
import { afterAll } from "vitest";

// Node's Web Storage globals can shadow JSDOM's storage in Vitest. Use the
// current test document's storage, rather than Node's file-backed implementation.
// Node-environment suites (e.g. image routes) do not have a JSDOM instance.
const testDom = (globalThis as typeof globalThis & {
  jsdom?: { window: Pick<Window, "localStorage" | "sessionStorage"> };
}).jsdom;
if (testDom) {
  for (const key of ["localStorage", "sessionStorage"] as const) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, {
      configurable: true,
      get: () => testDom.window[key],
    });
    afterAll(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
}

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
