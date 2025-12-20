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

