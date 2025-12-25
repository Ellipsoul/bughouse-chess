import { defineConfig } from "cypress";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  component: {
    devServer: {
      framework: "react",
      bundler: "vite",
      viteConfig: {
        plugins: [react()],
        /**
         * Cypress Component Testing uses Vite under the hood, which by default reads
         * `.env.local` from the project root. In sandboxed CI environments that file
         * can be unreadable (gitignored / permissioned).
         *
         * Point Vite at a repo-owned env directory so the test runner never touches
         * developer-local secrets.
         */
        envDir: path.resolve(__dirname, "./tests/env"),
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "./app"),
            "next/image": path.resolve(__dirname, "./cypress/support/mocks/next-image.tsx"),
          },
        },
      },
    },
    specPattern: "cypress/component/**/*.cy.{js,jsx,ts,tsx}",
    supportFile: "cypress/support/component.ts",
  },
  e2e: {
    // E2E tests will be added later
    setupNodeEvents() {
      // implement node event listeners here
    },
  },
});
