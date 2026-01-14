// ***********************************************************
// This example support/component.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import "./commands";

import { mount } from "cypress/react";
import { registerFirebaseCommands } from "./firebase";

// Augment the Cypress namespace to include type definitions for
// your custom command.
// Alternatively, can be defined in cypress/support/component.d.ts
// with a <reference path="./component" /> at the top of your spec.
declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add("mount", mount);

// Register Firebase Auth and Firestore emulator commands
registerFirebaseCommands();

/**
 * Handle uncaught exceptions from Firebase Analytics in test environment.
 * Firebase Analytics tries to fetch config from Firebase servers, which fails
 * in tests because we use fake API keys. We ignore these errors to prevent
 * test failures.
 */
Cypress.on("uncaught:exception", (err) => {
  // Ignore Firebase Analytics errors in test environment
  // Check both the error message and error name/code
  const errorMessage = err.message || "";
  const errorCode = (err as { code?: string }).code || "";
  const errorString = err.toString();

  // Match Firebase Analytics config fetch errors
  if (
    errorMessage.includes("Analytics: Dynamic config fetch failed") ||
    errorMessage.includes("analytics/config-fetch-failed") ||
    errorMessage.includes("API key not valid") ||
    errorString.includes("Analytics: Dynamic config fetch failed") ||
    errorString.includes("analytics/config-fetch-failed") ||
    errorCode === "analytics/config-fetch-failed"
  ) {
    // Return false to prevent Cypress from failing the test
    return false;
  }
  // Let other errors fail the test
  return true;
});
