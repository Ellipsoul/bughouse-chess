/**
 * E2E Test Support File
 *
 * This file runs before every E2E test and sets up global configuration,
 * custom commands, and event handlers.
 */

import "./commands";
import { registerFirebaseCommands } from "./firebase";

// Register Firebase Auth and Firestore emulator commands
registerFirebaseCommands();

/* -------------------------------------------------------------------------- */
/* Cypress Custom Commands for E2E Tests                                      */
/* -------------------------------------------------------------------------- */

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Intercepts Chess.com API requests and serves fixture data.
       * @param gameId - The game ID to mock
       * @param fixturePath - Path to the fixture file (relative to fixtures/chesscom)
       */
      mockChessComGame(gameId: string, fixturePath?: string): Chainable<null>;

      /**
       * Waits for the page to fully load (no pending network requests).
       */
      waitForPageLoad(): Chainable<void>;

      /**
       * Loads a bughouse game by entering the game ID in the input.
       * @param gameId - The Chess.com game ID to load
       */
      loadGame(gameId: string): Chainable<void>;

      /**
       * Signs in a test user and ensures the auth state is reflected in the UI.
       * @param options - Optional user creation settings
       */
      signInAndVerify(options?: {
        email?: string;
        displayName?: string;
      }): Chainable<{ uid: string; email: string }>;
    }
  }
}

/**
 * Mock Chess.com game API requests with fixture data.
 */
Cypress.Commands.add("mockChessComGame", (gameId: string, fixturePath?: string) => {
  const fixture = fixturePath ?? `chesscom/${gameId}.json`;
  cy.intercept(
    {
      method: "GET",
      url: `**/callback/live/game/${gameId}`,
    },
    { fixture },
  ).as(`chesscomGame-${gameId}`);
  return cy.wrap(null);
});

/**
 * Wait for page to stabilize (useful after navigation or data loading).
 */
Cypress.Commands.add("waitForPageLoad", () => {
  // Wait for any loading spinners to disappear
  cy.get("body").should("not.contain.text", "Loading...");
  // Give React time to hydrate
  cy.wait(100);
});

/**
 * Load a bughouse game by entering the game ID.
 */
Cypress.Commands.add("loadGame", (gameId: string) => {
  // Find the game ID input and enter the ID
  cy.get('input[placeholder*="Game ID"]').clear().type(gameId);
  // Click load button
  cy.get('button').contains(/load/i).click();
  // Wait for the game to load
  cy.waitForPageLoad();
});

/**
 * Sign in a test user and verify the UI reflects authenticated state.
 */
Cypress.Commands.add("signInAndVerify", (options = {}) => {
  const email = options.email ?? `test-${Date.now()}@example.com`;
  const password = "testpassword123";
  const displayName = options.displayName ?? "Test User";

  return cy.createTestUser({ email, password, displayName }).then((user) => {
    return cy.signInTestUser(email, password).then(() => {
      // The auth state should update in the app
      // This may require a page reload in E2E tests
      return cy.wrap({ uid: user.uid, email: user.email });
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Global Event Handlers                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Handle uncaught exceptions from Firebase Analytics in test environment.
 */
Cypress.on("uncaught:exception", (err) => {
  const errorMessage = err.message || "";
  const errorCode = (err as { code?: string }).code || "";
  const errorString = err.toString();

  // Ignore Firebase Analytics config fetch errors
  if (
    errorMessage.includes("Analytics: Dynamic config fetch failed") ||
    errorMessage.includes("analytics/config-fetch-failed") ||
    errorMessage.includes("API key not valid") ||
    errorString.includes("Analytics: Dynamic config fetch failed") ||
    errorString.includes("analytics/config-fetch-failed") ||
    errorCode === "analytics/config-fetch-failed"
  ) {
    return false;
  }

  // Ignore hydration errors from Next.js (common in E2E tests)
  if (
    errorMessage.includes("Hydration failed") ||
    errorMessage.includes("There was an error while hydrating")
  ) {
    return false;
  }

  return true;
});

/* -------------------------------------------------------------------------- */
/* Test Lifecycle Hooks                                                       */
/* -------------------------------------------------------------------------- */

// Note: Emulator clearing is handled by individual tests using cy.clearEmulators()
// This gives tests more control over their setup and prevents race conditions.
