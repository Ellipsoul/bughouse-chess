/**
 * Smoke Test - Firebase Emulator Setup Verification
 *
 * This minimal test verifies that:
 * 1. Cypress can connect to the Firebase Auth Emulator
 * 2. Cypress can connect to the Firebase Firestore Emulator
 * 3. User creation and authentication work correctly
 */

describe("Firebase Emulator Smoke Test", () => {
  it("can create a test user in the Auth Emulator", () => {
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
    // First create the user
    cy.createTestUser({
      email: "signin-test@example.com",
      password: "testpassword123",
      displayName: "Sign In Test",
    }).then(() => {
      // Then sign them in
      cy.signInTestUser("signin-test@example.com", "testpassword123").then((response) => {
        expect(response.idToken).to.be.a("string");
        expect(response.email).to.equal("signin-test@example.com");
      });
    });
  });

  it("can clear the Auth Emulator", () => {
    // Create a user first
    cy.createTestUser({
      email: "clear-test@example.com",
      password: "testpassword123",
    });

    // Clear the emulator
    cy.clearAuthEmulator();

    // Trying to sign in should now fail (user was deleted)
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
      // Should return error because user was deleted
      expect(response.ok).to.equal(false);
    });
  });

  it("can clear the Firestore Emulator", () => {
    // Clear should complete without error
    cy.clearFirestoreEmulator();
  });

  it("can use loginAsNewUser convenience method", () => {
    cy.loginAsNewUser({
      email: "convenience-test@example.com",
      displayName: "Convenience Test",
    }).then((user) => {
      expect(user.uid).to.be.a("string");
      expect(user.email).to.equal("convenience-test@example.com");
    });
  });
});
