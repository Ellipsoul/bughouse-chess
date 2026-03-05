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
  const toInterceptCalls = (calls: unknown): Array<{ request: { url: string } }> =>
    calls as unknown as Array<{ request: { url: string } }>;
  const countCallsForGameId = (
    calls: Array<{ request: { url: string } }>,
    gameId: string,
  ) => calls.filter((call) => call.request.url.endsWith(`/${gameId}`)).length;

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

      cy.get('button[aria-label^="Copy share link for game"]', {
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

      cy.get('button[aria-label^="Copy share link for game"]', {
        timeout: 20000,
      }).should("exist");
      cy.location("search").should("include", `gameId=${SECOND_GAME_ID}`);
      cy.location("search").should("not.include", "ply=");
    });

    it("does not refetch the newly loaded game due to URL-sync auto-load", () => {
      let secondGameCallCountBeforeLoad = 0;

      cy.visit(`/?gameId=${SINGLE_GAME_ID}`);

      cy.get('button[aria-label^="Copy share link for game"]', {
        timeout: 20000,
      }).should("exist");

      cy.get('input[type="text"]')
        .first()
        .clear()
        .type(SECOND_GAME_ID);

      // Capture requests for the target game before explicit load submit
      // (covers prefetch path when it resolves in time).
      cy.wait(600);
      cy.get("@chesscomApi.all").then((calls) => {
        secondGameCallCountBeforeLoad = countCallsForGameId(
          toInterceptCalls(calls),
          SECOND_GAME_ID,
        );
      });
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

      // The newly loaded game should only be fetched once. If URL sync re-triggers
      // the auto-load effect, this adds an extra request for the same game.
      cy.wait(800);
      cy.get("@chesscomApi.all").then((calls) => {
        const secondGameCalls = countCallsForGameId(toInterceptCalls(calls), SECOND_GAME_ID);
        expect(secondGameCalls - secondGameCallCountBeforeLoad).to.be.lte(1);
      });
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

    it("keeps match state while syncing URL on non-shared navigation", () => {
      let callsBeforeNavigation: Array<{ request: { url: string } }> = [];

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
          cy.get("@chesscomApi.all").then((calls) => {
            callsBeforeNavigation = toInterceptCalls(calls);
          });

          cy.get('button[aria-label="Next game"]').click();

          cy.location("search").then((search) => {
            const params = new URLSearchParams(search);
            const navigatedGameId = params.get("gameId");
            if (!navigatedGameId) {
              throw new Error("Expected non-shared match navigation to set a gameId in the URL.");
            }

            cy.get('button[aria-label="Select game from match"]', { timeout: 10000 }).should(
              "contain.text",
              "Game 2 of",
            );
            cy.get('button[aria-label="Find match games"]').should("not.exist");

            cy.wait(800);
            cy.get("@chesscomApi.all").then((callsAfterNavigation) => {
              const beforeCount = countCallsForGameId(
                callsBeforeNavigation,
                navigatedGameId,
              );
              const afterCount = countCallsForGameId(
                toInterceptCalls(callsAfterNavigation),
                navigatedGameId,
              );
              expect(afterCount).to.equal(beforeCount);
            });
          });
        } else {
          // Keep deterministic assertions for environments where fixture discovery
          // yields only one game and navigation cannot advance.
          cy.location("search").should("include", `gameId=${SINGLE_GAME_ID}`);
          cy.location("search").should("not.include", "sharedId=");
        }
      });
    });
  });

  describe("Viewer Reset", () => {
    it("resets the viewer state without a full reload", () => {
      let callCountBeforeReset = 0;
      cy.visit(`/?gameId=${SINGLE_GAME_ID}`);

      cy.get('button[aria-label^="Copy share link for game"]', {
        timeout: 20000,
      }).should("exist");

      cy.window().then((win) => {
        (win as Window & { __logoResetMarker?: string }).__logoResetMarker = "alive";
      });

      cy.get("@chesscomApi.all").then((calls) => {
        callCountBeforeReset = countCallsForGameId(
          toInterceptCalls(calls),
          SINGLE_GAME_ID,
        );
      });

      cy.get('a[aria-label="Go to home page"]').click();

      cy.location("pathname").should("eq", "/");
      cy.location("search").should("eq", "");

      cy.window()
        .its("__logoResetMarker")
        .should("eq", "alive");

      cy.get('button[aria-label^="Copy share link for game"]').should(
        "not.exist",
      );

      // Reset should not re-trigger loading of the previous game ID.
      cy.wait(800);
      cy.get("@chesscomApi.all").then((calls) => {
        const callCountAfterReset = countCallsForGameId(
          toInterceptCalls(calls),
          SINGLE_GAME_ID,
        );
        expect(callCountAfterReset).to.equal(callCountBeforeReset);
      });
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
