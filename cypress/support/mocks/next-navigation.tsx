/**
 * Mock `useRouter` for Cypress component tests.
 *
 * Next.js App Router hooks require the router context which isn't available
 * in Cypress component tests. This provides a minimal mock that tracks
 * navigation calls for testing.
 */

/**
 * Mock router implementation that captures navigation calls.
 * Test code can spy on `push` to verify navigation behavior.
 */
export function useRouter() {
  return {
    push: (href: string) => {
      // Store the navigation for test inspection if needed
      (window as unknown as { __lastPush?: string }).__lastPush = href;
    },
    replace: (href: string) => {
      (window as unknown as { __lastReplace?: string }).__lastReplace = href;
    },
    refresh: () => {},
    prefetch: () => Promise.resolve(),
    back: () => {},
    forward: () => {},
  };
}

/**
 * Mock `usePathname` hook.
 */
export function usePathname() {
  return "/";
}

/**
 * Mock `useSearchParams` hook.
 */
export function useSearchParams() {
  return new URLSearchParams();
}

/**
 * Mock `useParams` hook.
 */
export function useParams() {
  return {};
}

/**
 * Mock `redirect` function.
 */
export function redirect(url: string): never {
  throw new Error(`NEXT_REDIRECT:${url}`);
}

/**
 * Mock `notFound` function.
 */
export function notFound(): never {
  throw new Error("NEXT_NOT_FOUND");
}
