import ProfilePageClient from "../../app/profile/ProfilePageClient";
import { AuthProvider } from "../../app/auth/AuthProvider";
import type { AuthAdapter, AuthUser } from "../../app/auth/types";

/**
 * Creates a fake AuthAdapter with configurable behavior.
 */
function createFakeAdapter(options: {
  user: AuthUser | null;
  onSignIn?: () => void;
  onSignOut?: () => void;
  signInError?: Error;
  signOutError?: Error;
}): AuthAdapter {
  const { user, onSignIn, onSignOut, signInError, signOutError } = options;

  return {
    onAuthStateChanged: (callback) => {
      setTimeout(() => callback(user), 0);
      return () => {};
    },
    signInWithGooglePopup: async () => {
      if (signInError) {
        throw signInError;
      }
      onSignIn?.();
      return {
        uid: "new-user",
        email: "new@example.com",
        photoURL: null,
        displayName: "New User",
      };
    },
    signOut: async () => {
      if (signOutError) {
        throw signOutError;
      }
      onSignOut?.();
    },
  };
}

describe("ProfilePageClient", () => {
  describe("Signed Out State", () => {
    it("renders anonymous user UI", () => {
      const adapter = createFakeAdapter({ user: null });

      cy.mount(
        <AuthProvider adapter={adapter}>
          <ProfilePageClient />
        </AuthProvider>,
      );

      cy.contains("h1", "Anonymous User").should("be.visible");
      cy.contains("Please authenticate to unlock more features").should("be.visible");
      cy.contains("button", "Sign In with Google").should("be.visible");
    });

    it("renders back link to viewer", () => {
      const adapter = createFakeAdapter({ user: null });

      cy.mount(
        <AuthProvider adapter={adapter}>
          <ProfilePageClient />
        </AuthProvider>,
      );

      cy.contains("a", "Back to viewer")
        .should("be.visible")
        .and("have.attr", "href", "/");
    });

    it("calls signInWithGoogle when Sign In button is clicked", () => {
      const signInSpy = cy.stub().as("signIn");
      const adapter = createFakeAdapter({ user: null, onSignIn: signInSpy });

      cy.mount(
        <AuthProvider adapter={adapter}>
          <ProfilePageClient />
        </AuthProvider>,
      );

      cy.contains("button", "Sign In with Google").click();

      cy.get("@signIn").should("have.been.calledOnce");
    });

    it("shows loading state while signing in", () => {
      // Create adapter with delayed sign-in
      const adapter: AuthAdapter = {
        onAuthStateChanged: (callback) => {
          setTimeout(() => callback(null), 0);
          return () => {};
        },
        signInWithGooglePopup: () => new Promise(() => {}), // Never resolves
        signOut: async () => {},
      };

      cy.mount(
        <AuthProvider adapter={adapter}>
          <ProfilePageClient />
        </AuthProvider>,
      );

      cy.contains("button", "Sign In with Google").click();
      cy.contains("button", "Signing in...").should("be.visible");
    });
  });

  describe("Signed In State", () => {
    const signedInUser: AuthUser = {
      uid: "user-abc-123",
      email: "testuser@example.com",
      photoURL: "https://lh3.googleusercontent.com/a/test-avatar",
      displayName: "Test User",
    };

    it("renders user info when signed in", () => {
      const adapter = createFakeAdapter({ user: signedInUser });

      cy.mount(
        <AuthProvider adapter={adapter}>
          <ProfilePageClient />
        </AuthProvider>,
      );

      cy.contains("h1", "Test User").should("be.visible");
      cy.contains("testuser@example.com").should("be.visible");
      cy.contains("user-abc-123").should("be.visible");
      cy.contains("button", "Sign Out").should("be.visible");
    });

    it("displays avatar image when photoURL is available", () => {
      const adapter = createFakeAdapter({ user: signedInUser });

      cy.mount(
        <AuthProvider adapter={adapter}>
          <ProfilePageClient />
        </AuthProvider>,
      );

      cy.get('img[alt="Profile avatar for Test User"]').should("exist");
    });

    it("uses email as display name when displayName is null", () => {
      const userWithoutName: AuthUser = {
        uid: "user-123",
        email: "noname@example.com",
        photoURL: null,
        displayName: null,
      };
      const adapter = createFakeAdapter({ user: userWithoutName });

      cy.mount(
        <AuthProvider adapter={adapter}>
          <ProfilePageClient />
        </AuthProvider>,
      );

      cy.contains("h1", "noname@example.com").should("be.visible");
    });

    it("calls signOut when Sign Out button is clicked", () => {
      const signOutSpy = cy.stub().as("signOut");
      const adapter = createFakeAdapter({ user: signedInUser, onSignOut: signOutSpy });

      cy.mount(
        <AuthProvider adapter={adapter}>
          <ProfilePageClient />
        </AuthProvider>,
      );

      cy.contains("button", "Sign Out").click();

      cy.get("@signOut").should("have.been.calledOnce");
    });

    it("shows loading state while signing out", () => {
      const adapter: AuthAdapter = {
        onAuthStateChanged: (callback) => {
          setTimeout(() => callback(signedInUser), 0);
          return () => {};
        },
        signInWithGooglePopup: async () => signedInUser,
        signOut: () => new Promise(() => {}), // Never resolves
      };

      cy.mount(
        <AuthProvider adapter={adapter}>
          <ProfilePageClient />
        </AuthProvider>,
      );

      cy.contains("button", "Sign Out").click();
      cy.contains("button", "Signing out...").should("be.visible");
    });
  });

  describe("Loading State", () => {
    it("shows loading indicator while checking auth", () => {
      // Adapter that never fires callback
      const adapter: AuthAdapter = {
        onAuthStateChanged: () => () => {},
        signInWithGooglePopup: async () => ({
          uid: "x",
          email: "x@x.com",
          photoURL: null,
          displayName: null,
        }),
        signOut: async () => {},
      };

      cy.mount(
        <AuthProvider adapter={adapter}>
          <ProfilePageClient />
        </AuthProvider>,
      );

      cy.contains("Checking authentication...").should("be.visible");
    });
  });

  describe("Unavailable State", () => {
    it("shows unavailable message when auth is not configured", () => {
      // Adapter that throws on initialization
      const adapter: AuthAdapter = {
        onAuthStateChanged: () => {
          throw new Error("Firebase not configured");
        },
        signInWithGooglePopup: async () => {
          throw new Error("Not available");
        },
        signOut: async () => {
          throw new Error("Not available");
        },
      };

      cy.mount(
        <AuthProvider adapter={adapter}>
          <ProfilePageClient />
        </AuthProvider>,
      );

      cy.contains("Authentication Unavailable").should("be.visible");
      cy.contains("Firebase authentication is not configured").should("be.visible");
    });
  });

  // NOTE: Username feature tests require real Firebase services and are
  // covered by E2E tests in cypress/e2e/auth-flow.cy.ts:
  // - Username reservation flow
  // - Duplicate username prevention
  // - Username display after reservation
  //
  // Component tests here focus on UI state management with fake adapters.
});
