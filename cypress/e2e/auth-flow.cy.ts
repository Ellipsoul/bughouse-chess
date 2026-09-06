/**
 * E2E Tests for Authentication Flow
 *
 * Tests the user authentication journey including profile page
 * and sign out functionality.
 *
 * Note: Since the app uses Google OAuth which can't be automated,
 * these tests use the Firebase Auth emulator with email/password
 * to simulate authenticated state.
 */

describe("Authentication Flow", () => {
  beforeEach(() => {
    cy.clearEmulators();
  });

  describe("Profile Page - Signed Out", () => {
    it("shows anonymous user UI when not signed in", () => {
      cy.visit("/profile");

      cy.contains("h1", "Anonymous User", { timeout: 10000 }).should("be.visible");
      cy.contains("Please authenticate to unlock more features").should("be.visible");
      cy.contains("button", "Sign In with Google").should("be.visible");
    });

    it("has back link to main viewer", () => {
      cy.visit("/profile");

      cy.contains("a", "Back to viewer", { timeout: 10000 })
        .should("be.visible")
        .and("have.attr", "href", "/");
    });
  });

  describe("Profile Page - Signed In", () => {
    it("shows user info when signed in via emulator", () => {
      // Create and sign in a test user
      cy.loginWithFirebase({
        email: "profile-test@example.com",
        displayName: "Profile Test User",
      }).then(() => {
        // Visit profile page (will pick up auth state from localStorage)
        cy.visit("/profile");

        // Wait for auth state to propagate - the app should show signed-in state
        // Note: Due to how Firebase Auth persistence works, we may need to reload
        cy.reload();

        cy.get("h1:visible", { timeout: 10000 }).should("have.text", "Profile Test User");
      });
    });
  });

  describe("Navigation Integration", () => {
    it("opening explorer link navigates to the always-available route", () => {
      cy.visit("/");

      cy.get('a[aria-label="Opening explorer"]', { timeout: 10000 }).click();
      cy.url().should("include", "/opening-explorer");
      cy.contains("h1", "Opening explorer").should("be.visible");
    });

    it("sidebar profile link navigates to profile page", () => {
      cy.visit("/");

      cy.get('a[aria-label="Open profile"]', { timeout: 10000 }).click();
      cy.url().should("include", "/profile");
    });

    it("profile page back link returns to main viewer", () => {
      cy.visit("/profile");

      cy.contains("a", "Back to viewer", { timeout: 10000 }).click();
      cy.url().should("eq", Cypress.config().baseUrl + "/");
    });

    it("shared games link navigates to shared games page", () => {
      cy.visit("/");

      cy.get('a[aria-label="Browse shared games"]', { timeout: 10000 }).click();
      cy.url().should("include", "/shared-games");
    });

    it("analysis board link returns to the home page from another route", () => {
      cy.visit("/shared-games");

      cy.get('a[aria-label="Open analysis board"]', { timeout: 10000 }).click();
      cy.url().should("eq", Cypress.config().baseUrl + "/");
    });
  });

  describe("Sign Out Flow", () => {
    it("sign out button is visible when authenticated", () => {
      cy.loginWithFirebase({
        email: "signout-test@example.com",
        displayName: "Sign Out Test",
      }).then(() => {
        cy.visit("/profile");
        cy.reload();

        cy.get("h1:visible", { timeout: 10000 }).should("have.text", "Sign Out Test");
        cy.contains("button:visible", "Sign Out").click();
        cy.contains("h1", "Anonymous User").should("be.visible");
        cy.contains("button", "Sign In with Google").should("be.visible");
      });
    });
  });
});
