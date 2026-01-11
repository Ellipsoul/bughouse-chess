import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useUserPreferences } from "../../../app/utils/useUserPreferences";
import { AuthProvider } from "../../../app/auth/AuthProvider";
import type { AuthAdapter, AuthUser } from "../../../app/auth/types";
import { DEFAULT_BOARD_ANNOTATION_COLOR } from "../../../app/utils/userPreferencesService";
import * as userPreferencesService from "../../../app/utils/userPreferencesService";

// Mock the userPreferencesService
vi.mock("../../../app/utils/userPreferencesService", () => ({
  loadBoardAnnotationColor: vi.fn(),
  DEFAULT_BOARD_ANNOTATION_COLOR: "rgb(52, 168, 83, 0.95)",
}));

function createMockAuthAdapter(user: AuthUser | null): AuthAdapter {
  return {
    onAuthStateChanged: (callback) => {
      // Simulate immediate auth state
      callback(user);
      return () => {}; // Return unsubscribe function
    },
    signInWithGooglePopup: async () => {
      if (!user) throw new Error("No user");
      return user;
    },
    signOut: async () => {},
  };
}

describe("useUserPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset document root style
    document.documentElement.style.removeProperty("--bh-board-annotation-color");
  });

  it("loads preferences and updates CSS variable when user is signed in", async () => {
    const customColor = "rgb(255, 0, 0, 0.95)";
    vi.mocked(userPreferencesService.loadBoardAnnotationColor).mockResolvedValue(customColor);

    const mockAdapter = createMockAuthAdapter({
      uid: "user123",
      email: "test@example.com",
      displayName: null,
      photoURL: null,
    });

    renderHook(() => useUserPreferences(), {
      wrapper: ({ children }) => <AuthProvider adapter={mockAdapter}>{children}</AuthProvider>,
    });

    await waitFor(() => {
      expect(userPreferencesService.loadBoardAnnotationColor).toHaveBeenCalledWith("user123");
    });

    await waitFor(() => {
      const cssValue = document.documentElement.style.getPropertyValue("--bh-board-annotation-color");
      expect(cssValue).toBe(customColor);
    });
  });

  it("loads preferences and updates CSS variable when user is signed out", async () => {
    const customColor = "rgb(255, 0, 0, 0.95)";
    vi.mocked(userPreferencesService.loadBoardAnnotationColor).mockResolvedValue(customColor);

    const mockAdapter = createMockAuthAdapter(null);

    renderHook(() => useUserPreferences(), {
      wrapper: ({ children }) => <AuthProvider adapter={mockAdapter}>{children}</AuthProvider>,
    });

    await waitFor(() => {
      expect(userPreferencesService.loadBoardAnnotationColor).toHaveBeenCalledWith(null);
    });

    await waitFor(() => {
      const cssValue = document.documentElement.style.getPropertyValue("--bh-board-annotation-color");
      expect(cssValue).toBe(customColor);
    });
  });

  it("uses default color when loading fails", async () => {
    vi.mocked(userPreferencesService.loadBoardAnnotationColor).mockRejectedValue(
      new Error("Load failed"),
    );

    const mockAdapter = createMockAuthAdapter({
      uid: "user123",
      email: "test@example.com",
      displayName: null,
      photoURL: null,
    });

    renderHook(() => useUserPreferences(), {
      wrapper: ({ children }) => <AuthProvider adapter={mockAdapter}>{children}</AuthProvider>,
    });

    await waitFor(() => {
      expect(userPreferencesService.loadBoardAnnotationColor).toHaveBeenCalled();
    });

    await waitFor(() => {
      const cssValue = document.documentElement.style.getPropertyValue("--bh-board-annotation-color");
      expect(cssValue).toBe(DEFAULT_BOARD_ANNOTATION_COLOR);
    });
  });

  it("waits for auth status to be determined before loading", async () => {
    const user: AuthUser = {
      uid: "user123",
      email: "test@example.com",
      displayName: null,
      photoURL: null,
    };
    const mockAdapter: AuthAdapter = {
      onAuthStateChanged: (callback) => {
        // Delay the auth state change
        setTimeout(() => {
          callback(user);
        }, 100);
        return () => {};
      },
      signInWithGooglePopup: async () => user,
      signOut: async () => {},
    };

    const customColor = "rgb(255, 0, 0, 0.95)";
    vi.mocked(userPreferencesService.loadBoardAnnotationColor).mockResolvedValue(customColor);

    renderHook(() => useUserPreferences(), {
      wrapper: ({ children }) => <AuthProvider adapter={mockAdapter}>{children}</AuthProvider>,
    });

    // Should not be called immediately
    expect(userPreferencesService.loadBoardAnnotationColor).not.toHaveBeenCalled();

    await waitFor(
      () => {
        expect(userPreferencesService.loadBoardAnnotationColor).toHaveBeenCalledWith("user123");
      },
      { timeout: 200 },
    );
  });
});
