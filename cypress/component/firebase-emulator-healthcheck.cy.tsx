/**
 * Firebase Emulator Healthcheck
 *
 * This spec intentionally stays tiny and fast. Its only job is to verify that
 * the Firebase emulators are reachable and that our Cypress helper commands
 * remain valid. It is not a UI test.
 *
 * Run via `scripts/cypress-with-emulator.sh` so the emulators are available.
 */

describe("Firebase Emulator Healthcheck", () => {
  it("can create a test user in the Auth Emulator", () => {
    // Verifies that the Auth Emulator is reachable and user creation works.
    cy.createTestUser({
      email: "smoke-test@example.com",
      password: "testpassword123",
      displayName: "Smoke Test User",
    }).then((user) => {
      expect(user.uid).to.be.a("string");
      expect(user.email).to.equal("smoke-test@example.com");
      expect(user.displayName).to.equal("Smoke Test User");
    });
  });

  it("can sign in a test user", () => {
    // Confirms our sign-in helper can obtain a token from Auth Emulator.
    cy.createTestUser({
      email: "signin-test@example.com",
      password: "testpassword123",
      displayName: "Sign In Test",
    }).then(() => {
      cy.signInTestUser("signin-test@example.com", "testpassword123").then((response) => {
        expect(response.idToken).to.be.a("string");
        expect(response.email).to.equal("signin-test@example.com");
      });
    });
  });

  it("can clear the Auth Emulator", () => {
    // Ensures the reset endpoint is available for clean test isolation.
    cy.createTestUser({
      email: "clear-test@example.com",
      password: "testpassword123",
    });

    cy.clearAuthEmulator();

    // Direct REST sign-in should now fail because user was deleted.
    cy.wrap<Promise<Response>, Response>(
      fetch(
        "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "clear-test@example.com",
            password: "testpassword123",
            returnSecureToken: true,
          }),
        },
      ),
    ).then((response) => {
      expect(response.ok).to.equal(false);
    });
  });

  it("can clear the Firestore Emulator", () => {
    // This should complete without error so tests can start from a clean DB.
    cy.clearFirestoreEmulator();
  });

  it("can use loginAsNewUser convenience method", () => {
    // Confirms the convenience helper still wraps create + sign-in correctly.
    cy.loginAsNewUser({
      email: "convenience-test@example.com",
      displayName: "Convenience Test",
    }).then((user) => {
      expect(user.uid).to.be.a("string");
      expect(user.email).to.equal("convenience-test@example.com");
    });
  });
});
