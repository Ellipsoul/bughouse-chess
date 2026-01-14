/**
 * E2E Tests for Game Sharing Flows
 *
 * Tests the shared games page functionality.
 */

describe("Shared Games Page", () => {
  beforeEach(() => {
    cy.clearEmulators();
  });

  describe("Page Load", () => {
    it("loads the shared games page successfully", () => {
      cy.visit("/shared-games");

      // Page should load without errors
      cy.get("body", { timeout: 10000 }).should("be.visible");
    });

    it("displays page title or heading", () => {
      cy.visit("/shared-games");

      // Should have some indication this is the shared games page
      cy.contains(/shared|games|browse/i, { timeout: 10000 }).should("exist");
    });
  });

  describe("Navigation", () => {
    it("can navigate to shared games from home page", () => {
      cy.visit("/");

      cy.get('a[aria-label="Browse shared games"]', { timeout: 10000 }).click();
      cy.url().should("include", "/shared-games");
    });

    it("can navigate back to home from shared games", () => {
      cy.visit("/shared-games");

      // Find a link back to home (could be logo, back button, etc.)
      cy.get('a[href="/"]', { timeout: 10000 }).first().click();
      cy.url().should("eq", Cypress.config().baseUrl + "/");
    });
  });

  describe("Anonymous User Access", () => {
    it("allows anonymous users to view shared games page", () => {
      cy.visit("/shared-games");

      // Page should be accessible without authentication
      cy.get("body", { timeout: 10000 }).should("be.visible");
      // Should not redirect to login or show auth error
      cy.url().should("include", "/shared-games");
    });
  });

  describe("Authenticated User", () => {
    it("authenticated user can access shared games page", () => {
      cy.loginWithFirebase({
        email: "viewer@example.com",
        displayName: "Viewer User",
      }).then(() => {
        cy.visit("/shared-games");
        cy.reload();

        // Page should load
        cy.get("body", { timeout: 10000 }).should("be.visible");
      });
    });
  });
});
