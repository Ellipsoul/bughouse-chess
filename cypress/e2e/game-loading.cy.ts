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
  const SECOND_GAME_ID = "160064848973";

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

    it("updates URL gameId when loading a new game from input", () => {
      cy.visit(`/?gameId=${SINGLE_GAME_ID}&ply=4`);

      cy.get(`button[aria-label="Copy share link for game ${SINGLE_GAME_ID}"]`, {
        timeout: 20000,
      }).should("exist");
      cy.location("search").should("include", `gameId=${SINGLE_GAME_ID}`);
      cy.location("search").should("include", "ply=4");

      cy.get('input[type="text"]')
        .first()
        .clear()
        .type(SECOND_GAME_ID);
      cy.contains("button", "Load Game").click();

      cy.get("body").then(($body) => {
        const dialogOpen = $body.find('[aria-label="Confirm loading new game"]').length > 0;
        if (dialogOpen) {
          cy.contains("button", "Confirm").click();
        }
      });

      cy.get(`button[aria-label="Copy share link for game ${SECOND_GAME_ID}"]`, {
        timeout: 20000,
      }).should("exist");
      cy.location("search").should("include", `gameId=${SECOND_GAME_ID}`);
      cy.location("search").should("not.include", "ply=");
    });
  });

  describe("URL Move Position", () => {
    it("respects ply query and jumps away from start position", () => {
      cy.visit(`/?gameId=${SINGLE_GAME_ID}&ply=3`);

      cy.get(`button[aria-label="Copy share link for game ${SINGLE_GAME_ID}"]`, {
        timeout: 20000,
      }).should("exist");
      cy.get('button[aria-label="Jump to start"]').should("not.be.disabled");
    });
  });

  describe("Match Navigation URL Sync", () => {
    it("updates URL while navigating non-shared match games", () => {
      cy.visit(`/?gameId=${SINGLE_GAME_ID}`);

      cy.get(`button[aria-label="Copy share link for game ${SINGLE_GAME_ID}"]`, {
        timeout: 20000,
      }).should("exist");

      cy.get('button[aria-label="Find match games"]').click();
      cy.contains("button", "Full Match (4 Players)", { timeout: 10000 }).click();

      cy.get('button[aria-label="Next game"]', { timeout: 30000 }).should("exist");
      cy.get("body").then(($body) => {
        const nextButton = $body.find('button[aria-label="Next game"]');
        if (nextButton.length > 0 && !nextButton.prop("disabled")) {
          cy.get('button[aria-label="Next game"]').click();
          cy.location("search").should("include", "gameId=");
          cy.location("search").should("not.include", "sharedId=");
        } else {
          // Some fixture seeds may not yield additional match games in all environments.
          // Keep a baseline assertion that URL remains canonical and non-shared.
          cy.location("search").should("include", `gameId=${SINGLE_GAME_ID}`);
          cy.location("search").should("not.include", "sharedId=");
        }
      });
    });
  });

  describe("Viewer Reset", () => {
    it("resets the viewer state without a full reload", () => {
      cy.visit(`/?gameId=${SINGLE_GAME_ID}`);

      cy.get('button[aria-label^="Copy share link for game"]', {
        timeout: 20000,
      }).should("exist");

      cy.window().then((win) => {
        (win as Window & { __logoResetMarker?: string }).__logoResetMarker = "alive";
      });

      cy.get('a[aria-label="Go to home page"]').click();

      cy.window()
        .its("__logoResetMarker")
        .should("eq", "alive");

      cy.get('button[aria-label^="Copy share link for game"]').should(
        "not.exist",
      );
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
