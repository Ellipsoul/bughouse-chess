import Sidebar from "../../app/components/Sidebar";
import { AuthProvider } from "../../app/auth/AuthProvider";
import type { AuthAdapter, AuthUser } from "../../app/auth/types";

/**
 * Creates a fake AuthAdapter that immediately resolves to the given user state.
 */
function createFakeAdapter(user: AuthUser | null): AuthAdapter {
  return {
    onAuthStateChanged: (callback) => {
      // Immediately fire with the provided user
      setTimeout(() => callback(user), 0);
      return () => {};
    },
    signInWithGooglePopup: async () => ({
      uid: "test-uid",
      email: "test@example.com",
      photoURL: null,
      displayName: "Test User",
    }),
    signOut: async () => {},
  };
}

describe("Sidebar", () => {
  it("renders shared games link with correct href", () => {
    const adapter = createFakeAdapter(null);

    cy.mount(
      <AuthProvider adapter={adapter}>
        <Sidebar />
      </AuthProvider>,
    );

    cy.get('a[aria-label="Browse shared games"]')
      .should("exist")
      .and("have.attr", "href", "/shared-games");
  });

  it("renders GitHub link with correct href", () => {
    const adapter = createFakeAdapter(null);

    cy.mount(
      <AuthProvider adapter={adapter}>
        <Sidebar />
      </AuthProvider>,
    );

    cy.get('a[aria-label="View source code on GitHub"]')
      .should("exist")
      .and("have.attr", "href", "https://github.com/Ellipsoul/bughouse-chess")
      .and("have.attr", "target", "_blank");
  });

  it("renders profile link pointing to /profile", () => {
    const adapter = createFakeAdapter(null);

    cy.mount(
      <AuthProvider adapter={adapter}>
        <Sidebar />
      </AuthProvider>,
    );

    cy.get('a[aria-label="Open profile"]')
      .should("exist")
      .and("have.attr", "href", "/profile");
  });

  it("shows UserRound icon when signed out", () => {
    const adapter = createFakeAdapter(null);

    cy.mount(
      <AuthProvider adapter={adapter}>
        <Sidebar />
      </AuthProvider>,
    );

    // The profile button should contain the UserRound icon (svg with lucide class)
    cy.get('a[aria-label="Open profile"]')
      .find("svg")
      .should("exist");

    // Should NOT have an img element
    cy.get('a[aria-label="Open profile"]')
      .find("img")
      .should("not.exist");
  });

  it("shows avatar image when signed in with photoURL", () => {
    const signedInUser: AuthUser = {
      uid: "user-123",
      email: "test@example.com",
      photoURL: "https://lh3.googleusercontent.com/a/test-avatar",
      displayName: "Test User",
    };
    const adapter = createFakeAdapter(signedInUser);

    cy.mount(
      <AuthProvider adapter={adapter}>
        <Sidebar />
      </AuthProvider>,
    );

    // Wait for auth state to settle and avatar image to appear
    // ProfileAvatar renders multiple img elements for different breakpoints,
    // so we check for any img with the correct alt text
    cy.get('a[aria-label="Open profile"]')
      .should("exist")
      .find("img")
      .should("exist")
      .first()
      .should("have.attr", "alt", "Profile avatar for test@example.com");
  });

  it("shows UserRound icon when signed in but no photoURL", () => {
    const signedInUser: AuthUser = {
      uid: "user-123",
      email: "test@example.com",
      photoURL: null,
      displayName: "Test User",
    };
    const adapter = createFakeAdapter(signedInUser);

    cy.mount(
      <AuthProvider adapter={adapter}>
        <Sidebar />
      </AuthProvider>,
    );

    // Wait for auth state to settle by first ensuring the profile link exists
    cy.get('a[aria-label="Open profile"]').should("exist");

    // Should show the fallback UserRound icon
    cy.get('a[aria-label="Open profile"]')
      .find("svg")
      .should("exist");

    cy.get('a[aria-label="Open profile"]')
      .find("img")
      .should("not.exist");
  });

  it("has accessible sidebar landmark", () => {
    const adapter = createFakeAdapter(null);

    cy.mount(
      <AuthProvider adapter={adapter}>
        <Sidebar />
      </AuthProvider>,
    );

    cy.get('aside[aria-label="App sidebar"]').should("exist");
  });
});
