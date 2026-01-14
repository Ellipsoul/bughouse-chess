import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Vitest configuration for the bughouse-chess Next.js app.
 *
 * We intentionally focus coverage on deterministic logic (rules engine + utilities + state),
 * while UI components are primarily covered via Cypress Component Testing.
 */
export default defineConfig({
  plugins: [react()],
  /**
   * In CI / sandboxed environments, `.env.local` is often gitignored and may be
   * unreadable to tooling (even though it exists on a developer machine).
   *
   * Point Vitest's underlying Vite config at a repo-owned env dir to keep tests
   * deterministic and avoid accidental dependency on local secrets.
   */
  envDir:
    process.env.VITEST === "true"
      ? fileURLToPath(new URL("./tests/env", import.meta.url))
      : undefined,
  resolve: {
    // Keep TS path alias parity with `tsconfig.json`'s "@/*": ["./*"].
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: [
        "app/utils/**/*.{ts,tsx}",
        "app/types/**/*.{ts,tsx}",
        "app/chesscom_movelist_parse.ts",
        "app/actions.ts",
        "app/components/moves/useAnalysisState.ts",
      ],
      exclude: [
        "**/*.d.ts",
        "app/**/*.css",
        "app/**/layout.tsx",
        "app/**/page.tsx",
        "app/providers.tsx",
        "app/components/**/*.tsx",
        "!app/components/moves/useAnalysisState.ts",
      ],
    },
  },
});
