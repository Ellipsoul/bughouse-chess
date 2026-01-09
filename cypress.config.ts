import { defineConfig } from "cypress";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Test environment variables for Firebase Emulator Suite.
 *
 * These are fake/demo values since the emulator doesn't require real credentials.
 * The FIRESTORE_EMULATOR_HOST tells the Firebase SDK to connect to the local emulator.
 */
const testEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "fake-api-key-for-testing",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-bughouse.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-bughouse",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-bughouse.appspot.com",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789012",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789012:web:abcdef123456",
  NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
};

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
        /**
         * Define test environment variables for Firebase Emulator Suite.
         * These are injected at build time and available via process.env.
         */
        define: {
          "process.env.NEXT_PUBLIC_FIREBASE_API_KEY": JSON.stringify(testEnv.NEXT_PUBLIC_FIREBASE_API_KEY),
          "process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN": JSON.stringify(testEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
          "process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID": JSON.stringify(testEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
          "process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET": JSON.stringify(testEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
          "process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID": JSON.stringify(testEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
          "process.env.NEXT_PUBLIC_FIREBASE_APP_ID": JSON.stringify(testEnv.NEXT_PUBLIC_FIREBASE_APP_ID),
          "process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST": JSON.stringify(testEnv.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST),
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "./app"),
            "next/image": path.resolve(__dirname, "./cypress/support/mocks/next-image.tsx"),
            "next/link": path.resolve(__dirname, "./cypress/support/mocks/next-link.tsx"),
            "next/navigation": path.resolve(__dirname, "./cypress/support/mocks/next-navigation.tsx"),
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
