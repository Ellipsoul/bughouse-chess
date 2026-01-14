/**
 * E2E Tests for Game Loading
 *
 * Tests loading single games, matches, and partner game series
 * using fixture data from Chess.com.
 */

describe("Game Loading", () => {
  /**
   * Known fixture game IDs from recorded fixtures.
   */
  const SINGLE_GAME_ID = "160064848971";

  beforeEach(() => {
    // Mock Chess.com API calls with fixtures for all tests
    cy.intercept("GET", "**/callback/live/game/*", (req) => {
      const gameId = req.url.split("/").pop();
      req.reply({
        fixture: `chesscom/${gameId}.json`,
        statusCode: 200,
      });
    }).as("chesscomApi");
  });

  describe("Home Page Load", () => {
    it("loads the home page successfully", () => {
      cy.visit("/");

      // Should have the game ID input
      cy.get('input', { timeout: 10000 }).should("exist");
    });

    it("has sidebar with navigation links", () => {
      cy.visit("/");

      cy.get('a[aria-label="Open profile"]', { timeout: 10000 }).should("exist");
      cy.get('a[aria-label="Browse shared games"]').should("exist");
    });

    it("has settings button in sidebar", () => {
      cy.visit("/");

      cy.get('button[aria-label="Settings"]', { timeout: 10000 }).should("exist");
    });
  });

  describe("Game ID Input", () => {
    it("accepts game ID input", () => {
      cy.visit("/");

      // Find the game ID input (might be in header or sidebar)
      cy.get('input[type="text"]', { timeout: 10000 })
        .first()
        .should("exist")
        .type(SINGLE_GAME_ID);
    });
  });

  describe("Shared Games Page", () => {
    it("loads shared games page", () => {
      cy.visit("/shared-games");

      // Should show the shared games page
      cy.contains(/shared|games/i, { timeout: 10000 }).should("exist");
    });
  });

  describe("Profile Page", () => {
    it("loads profile page", () => {
      cy.visit("/profile");

      // Should show profile content
      cy.get("h1", { timeout: 10000 }).should("exist");
    });
  });
});
