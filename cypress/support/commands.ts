/**
 * Shared Cypress custom-command type declarations.
 *
 * Domain-specific commands live in `e2e.ts` (E2E flows) and `firebase.ts`
 * (emulator helpers). This file augments the global `Cypress.Chainable` interface
 * so TypeScript recognizes commands registered from those support modules.
 */
/// <reference types="cypress" />

export {};

declare global {
  namespace Cypress {
    interface Chainable {
      // Add custom command types here
    }
  }
}
