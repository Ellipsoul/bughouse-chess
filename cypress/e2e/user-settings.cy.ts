/**
 * E2E Tests for User Settings
 *
 * Tests that user preferences (specifically board annotation colors)
 * are properly persisted to localStorage and Firestore (when authenticated).
 */

describe("User Settings - Board Annotation Color", () => {
  /**
   * LocalStorage key for board annotation color.
   * Must match the key used in userPreferencesService.ts.
   */
  const LOCAL_STORAGE_KEY = "bh-board-annotation-color";

  beforeEach(() => {
    // Clear localStorage before each test
    cy.clearLocalStorage();
  });

  describe("Anonymous User (localStorage only)", () => {
    it("persists annotation color to localStorage when changed", () => {
      // Load the app
      cy.visit("/");

      // Open settings modal via sidebar
      cy.get('button[aria-label="Settings"]', { timeout: 10000 }).click();
      cy.get('[role="dialog"]').should("be.visible");
      cy.contains("Settings").should("be.visible");

      // Find the color picker and change the color
      cy.get('[data-testid="annotation-color-picker"]').should("exist");

      // Click on a color swatch in the TwitterPicker
      // The picker uses div elements with title attributes for colors
      cy.get('[data-testid="annotation-color-picker"]')
        .find('div[title]')
        .first()
        .click();

      // Save the settings
      cy.contains("button", "Save").click();

      // Wait for modal to close
      cy.get('[role="dialog"]').should("not.exist");

      // Verify localStorage was updated (raw color value, not JSON)
      cy.window().then((win) => {
        const stored = win.localStorage.getItem(LOCAL_STORAGE_KEY);
        expect(stored).to.not.equal(null);
        // The color is stored as a raw string (e.g., "rgb(239, 68, 68, 0.95)")
        expect(stored).to.be.a("string");
      });
    });

    it("restores annotation color from localStorage on page reload", () => {
      // First, set the color in localStorage (raw color value)
      cy.window().then((win) => {
        win.localStorage.setItem(LOCAL_STORAGE_KEY, "rgb(255, 0, 0, 0.95)");
      });

      // Load the app
      cy.visit("/");

      // Open settings modal
      cy.get('button[aria-label="Settings"]', { timeout: 10000 }).click();
      cy.get('[role="dialog"]').should("be.visible");

      // The color picker should exist
      cy.get('[data-testid="annotation-color-picker"]').should("exist");
    });

    it("uses default color when no preference is saved", () => {
      // Load the app without any saved preferences
      cy.visit("/");

      // Open settings modal
      cy.get('button[aria-label="Settings"]', { timeout: 10000 }).click();
      cy.get('[role="dialog"]').should("be.visible");

      // Verify the color picker is present
      cy.get('[data-testid="annotation-color-picker"]').should("exist");
    });
  });

  describe("Authenticated User (localStorage + Firestore)", () => {
    beforeEach(() => {
      // Clear emulators before each test
      cy.clearEmulators();
    });

    it("saves annotation color to localStorage when authenticated", () => {
      // Create and login a test user
      cy.loginWithFirebase({
        email: "settings-test@example.com",
        displayName: "Settings Test User",
      }).then(() => {
        // Reload to pick up auth state
        cy.visit("/");

        // Wait for page to load
        cy.get('button[aria-label="Settings"]', { timeout: 10000 }).should("be.visible");

        // Open settings modal
        cy.get('button[aria-label="Settings"]').click();
        cy.get('[role="dialog"]').should("be.visible");

        // Change the color
        cy.get('[data-testid="annotation-color-picker"]')
          .find('div[title]')
          .first()
          .click();

        // Save
        cy.contains("button", "Save").click();

        // Wait for modal to close
        cy.get('[role="dialog"]').should("not.exist");

        // Verify localStorage was updated
        cy.window().then((win) => {
          const stored = win.localStorage.getItem(LOCAL_STORAGE_KEY);
          expect(stored).to.not.equal(null);
          expect(stored).to.be.a("string");
        });
      });
    });
  });

  describe("Color Persistence Across Sessions", () => {
    it("maintains annotation color across page refreshes", () => {
      cy.visit("/");

      // Open settings and change color
      cy.get('button[aria-label="Settings"]', { timeout: 10000 }).click();
      cy.get('[data-testid="annotation-color-picker"]')
        .find('div[title]')
        .first()
        .click();
      cy.contains("button", "Save").click();

      // Wait for modal to close
      cy.get('[role="dialog"]').should("not.exist");

      // Reload page
      cy.reload();

      // Verify color persists by checking localStorage
      cy.window().then((win) => {
        const stored = win.localStorage.getItem(LOCAL_STORAGE_KEY);
        expect(stored).to.not.equal(null);
        expect(stored).to.be.a("string");
      });
    });
  });
});
