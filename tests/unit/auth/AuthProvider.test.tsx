import { describe, it, expect, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { AuthProvider } from "../../../app/auth/AuthProvider";
import { useAuth } from "../../../app/auth/useAuth";
import type { AuthAdapter, AuthUser } from "../../../app/auth/types";

/**
 * Creates a fake AuthAdapter for testing.
 *
 * @param options - Configuration for the fake adapter behavior
 */
function createFakeAdapter(options: {
  initialUser?: AuthUser | null;
  onAuthStateChangedDelay?: number;
  signInResult?: AuthUser | Error;
  signOutResult?: void | Error;
} = {}): AuthAdapter & { triggerAuthChange: (user: AuthUser | null) => void } {
  const {
    initialUser = null,
    onAuthStateChangedDelay = 0,
    signInResult,
    signOutResult,
  } = options;

  let authCallback: ((user: AuthUser | null) => void) | null = null;

  return {
    onAuthStateChanged: (callback) => {
      authCallback = callback;
      // Simulate async initialization
      setTimeout(() => {
        callback(initialUser);
      }, onAuthStateChangedDelay);
      // Return unsubscribe function
      return () => {
        authCallback = null;
      };
    },
    signInWithGooglePopup: async () => {
      if (signInResult instanceof Error) {
        throw signInResult;
      }
      return signInResult ?? { uid: "test-uid", email: "test@example.com", photoURL: null, displayName: "Test" };
    },
    signOut: async () => {
      if (signOutResult instanceof Error) {
        throw signOutResult;
      }
    },
    triggerAuthChange: (user: AuthUser | null) => {
      if (authCallback) {
        authCallback(user);
      }
    },
  };
}

/**
 * Test component that consumes auth context and displays state.
 */
function AuthConsumer() {
  const { status, user, signInWithGoogle, signOut } = useAuth();

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="email">{user?.email ?? "none"}</span>
      <span data-testid="uid">{user?.uid ?? "none"}</span>
      <button onClick={() => void signInWithGoogle()}>Sign In</button>
      <button onClick={() => void signOut()}>Sign Out</button>
    </div>
  );
}

describe("AuthProvider", () => {
  it("starts in loading state", () => {
    const adapter = createFakeAdapter({ onAuthStateChangedDelay: 1000 });

    render(
      <AuthProvider adapter={adapter}>
        <AuthConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("loading");
  });

  it("transitions to signed_out when no user", async () => {
    const adapter = createFakeAdapter({ initialUser: null });

    render(
      <AuthProvider adapter={adapter}>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("signed_out");
    });
  });

  it("transitions to signed_in when user exists", async () => {
    const testUser: AuthUser = {
      uid: "user-123",
      email: "user@example.com",
      photoURL: "https://example.com/avatar.jpg",
      displayName: "Test User",
    };
    const adapter = createFakeAdapter({ initialUser: testUser });

    render(
      <AuthProvider adapter={adapter}>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("signed_in");
      expect(screen.getByTestId("email")).toHaveTextContent("user@example.com");
      expect(screen.getByTestId("uid")).toHaveTextContent("user-123");
    });
  });

  it("handles auth state changes after initial load", async () => {
    const adapter = createFakeAdapter({ initialUser: null });

    render(
      <AuthProvider adapter={adapter}>
        <AuthConsumer />
      </AuthProvider>,
    );

    // Wait for initial signed_out state
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("signed_out");
    });

    // Simulate user signing in externally
    act(() => {
      adapter.triggerAuthChange({
        uid: "new-user",
        email: "new@example.com",
        photoURL: null,
        displayName: null,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("signed_in");
      expect(screen.getByTestId("email")).toHaveTextContent("new@example.com");
    });
  });

  it("handles sign out transition", async () => {
    const testUser: AuthUser = {
      uid: "user-123",
      email: "user@example.com",
      photoURL: null,
      displayName: null,
    };
    const adapter = createFakeAdapter({ initialUser: testUser });

    render(
      <AuthProvider adapter={adapter}>
        <AuthConsumer />
      </AuthProvider>,
    );

    // Wait for signed_in state
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("signed_in");
    });

    // Simulate user signing out
    act(() => {
      adapter.triggerAuthChange(null);
    });

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("signed_out");
      expect(screen.getByTestId("email")).toHaveTextContent("none");
    });
  });

  it("sets unavailable status when adapter initialization fails", async () => {
    // Create an adapter that throws during onAuthStateChanged
    const errorAdapter: AuthAdapter = {
      onAuthStateChanged: () => {
        throw new Error("Firebase not configured");
      },
      signInWithGooglePopup: vi.fn(),
      signOut: vi.fn(),
    };

    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <AuthProvider adapter={errorAdapter}>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("unavailable");
    });

    consoleSpy.mockRestore();
  });

  it("uses default Firebase adapter when none provided", () => {
    // This test verifies the provider doesn't crash when no adapter is passed.
    // The actual Firebase adapter will fail gracefully if env vars are missing.
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Should not throw
    expect(() => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      );
    }).not.toThrow();

    consoleSpy.mockRestore();
  });
});

describe("useAuth", () => {
  it("throws when used outside AuthProvider", () => {
    // Suppress console.error for expected error
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<AuthConsumer />);
    }).toThrow("useAuth must be used within <AuthProvider>");

    consoleSpy.mockRestore();
  });
});
