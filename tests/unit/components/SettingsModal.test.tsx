import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import SettingsModal from "../../../app/components/modals/SettingsModal";
import * as userPreferencesService from "../../../app/utils/userPreferencesService";
import toast from "react-hot-toast";

// Mock react-color
vi.mock("react-color", () => ({
  TwitterPicker: ({ color, onChange }: { color: string; onChange: (color: { hex: string }) => void }) => (
    <div data-testid="twitter-picker">
      <input
        data-testid="color-input"
        value={color}
        onChange={(e) => onChange({ hex: e.target.value })}
      />
      <button
        data-testid="color-swatch"
        onClick={() => onChange({ hex: "#FF0000" })}
      >
        Red
      </button>
    </div>
  ),
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock userPreferencesService
vi.mock("../../../app/utils/userPreferencesService", () => ({
  getBoardAnnotationColorFromLocalStorage: vi.fn(),
  saveBoardAnnotationColorToLocalStorage: vi.fn(),
  removeBoardAnnotationColorFromLocalStorage: vi.fn(),
  saveUserPreferencesToFirestore: vi.fn(),
  loadAutoAdvanceLiveReplayPreference: vi.fn(),
  saveAutoAdvanceLiveReplayToLocalStorage: vi.fn(),
  DEFAULT_BOARD_ANNOTATION_COLOR: "rgb(52, 168, 83, 0.95)",
}));

// Mock firebase/firestore
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

describe("SettingsModal", () => {
  const defaultButtonPosition = {
    top: 100,
    left: 50,
    width: 40,
    height: 40,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.style.removeProperty("--bh-board-annotation-color");
    vi.mocked(userPreferencesService.getBoardAnnotationColorFromLocalStorage).mockReturnValue(
      "rgb(52, 168, 83, 0.95)",
    );
    vi.mocked(userPreferencesService.loadAutoAdvanceLiveReplayPreference).mockResolvedValue(false);
  });

  it("does not render when open is false", () => {
    render(
      <SettingsModal
        open={false}
        userId={null}
        buttonPosition={defaultButtonPosition}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders when open is true", () => {
    render(
      <SettingsModal
        open={true}
        userId={null}
        buttonPosition={defaultButtonPosition}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Board Annotation Color")).toBeInTheDocument();
    expect(screen.getByText("Auto-advance live replay")).toBeInTheDocument();
  });

  it("loads auto-advance preference when opened", async () => {
    vi.mocked(userPreferencesService.loadAutoAdvanceLiveReplayPreference).mockResolvedValue(true);

    render(
      <SettingsModal
        open={true}
        userId={null}
        buttonPosition={defaultButtonPosition}
        onClose={vi.fn()}
      />,
    );

    const checkbox = screen.getByRole("checkbox");
    await waitFor(() => {
      expect(checkbox).toBeChecked();
    });
  });

  it("loads initial color from localStorage when opened", () => {
    const customColor = "rgb(255, 0, 0, 0.95)";
    vi.mocked(userPreferencesService.getBoardAnnotationColorFromLocalStorage).mockReturnValue(
      customColor,
    );

    render(
      <SettingsModal
        open={true}
        userId={null}
        buttonPosition={defaultButtonPosition}
        onClose={vi.fn()}
      />,
    );

    expect(userPreferencesService.getBoardAnnotationColorFromLocalStorage).toHaveBeenCalled();
  });

  it("updates CSS variable in real-time when color changes", async () => {
    render(
      <SettingsModal
        open={true}
        userId={null}
        buttonPosition={defaultButtonPosition}
        onClose={vi.fn()}
      />,
    );

    const colorSwatch = screen.getByTestId("color-swatch");
    await act(async () => {
      fireEvent.click(colorSwatch);
    });

    await waitFor(() => {
      const cssValue = document.documentElement.style.getPropertyValue("--bh-board-annotation-color");
      expect(cssValue).toBe("rgb(255, 0, 0, 0.95)");
    });

    expect(userPreferencesService.saveBoardAnnotationColorToLocalStorage).toHaveBeenCalledWith(
      "rgb(255, 0, 0, 0.95)",
    );
  });

  it("saves to localStorage in real-time when color changes", async () => {
    render(
      <SettingsModal
        open={true}
        userId={null}
        buttonPosition={defaultButtonPosition}
        onClose={vi.fn()}
      />,
    );

    const colorSwatch = screen.getByTestId("color-swatch");
    await act(async () => {
      fireEvent.click(colorSwatch);
    });

    await waitFor(() => {
      expect(userPreferencesService.saveBoardAnnotationColorToLocalStorage).toHaveBeenCalledWith(
        "rgb(255, 0, 0, 0.95)",
      );
    });
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(
      <SettingsModal
        open={true}
        userId={null}
        buttonPosition={defaultButtonPosition}
        onClose={onClose}
      />,
    );

    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it("reverts color when Cancel is clicked", async () => {
    const initialColor = "rgb(52, 168, 83, 0.95)";
    vi.mocked(userPreferencesService.getBoardAnnotationColorFromLocalStorage).mockReturnValue(
      initialColor,
    );

    render(
      <SettingsModal
        open={true}
        userId={null}
        buttonPosition={defaultButtonPosition}
        onClose={vi.fn()}
      />,
    );

    // Change color
    const colorSwatch = screen.getByTestId("color-swatch");
    await act(async () => {
      fireEvent.click(colorSwatch);
    });

    // Click cancel
    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);

    // Should revert to initial color
    await waitFor(() => {
      const cssValue = document.documentElement.style.getPropertyValue("--bh-board-annotation-color");
      expect(cssValue).toBe(initialColor);
    });
  });

  it("saves to Firestore when Save is clicked and user is authenticated", async () => {
    vi.mocked(userPreferencesService.saveUserPreferencesToFirestore).mockResolvedValue(undefined);
    vi.mocked(userPreferencesService.loadAutoAdvanceLiveReplayPreference).mockResolvedValue(true);

    render(
      <SettingsModal
        open={true}
        userId="user123"
        buttonPosition={defaultButtonPosition}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("checkbox")).toBeChecked();
    });

    // Change color
    const colorSwatch = screen.getByTestId("color-swatch");
    await act(async () => {
      fireEvent.click(colorSwatch);
    });

    // Click save
    const saveButton = screen.getByText("Save");
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(userPreferencesService.saveUserPreferencesToFirestore).toHaveBeenCalledWith(
        "user123",
        {
          boardAnnotationColor: "rgb(255, 0, 0, 0.95)",
          autoAdvanceLiveReplay: true,
        },
      );
    });

    expect(toast.success).toHaveBeenCalledWith("Settings saved!");
  });

  it("shows success toast for non-authenticated users when Save is clicked", async () => {
    render(
      <SettingsModal
        open={true}
        userId={null}
        buttonPosition={defaultButtonPosition}
        onClose={vi.fn()}
      />,
    );

    const saveButton = screen.getByText("Save");
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Settings saved!");
    });

    await waitFor(() => {
      expect(userPreferencesService.saveAutoAdvanceLiveReplayToLocalStorage).toHaveBeenCalledWith(false);
    });
    expect(userPreferencesService.saveUserPreferencesToFirestore).not.toHaveBeenCalled();
  });

  it("handles save errors gracefully", async () => {
    const error = new Error("Firestore error");
    vi.mocked(userPreferencesService.saveUserPreferencesToFirestore).mockRejectedValue(error);

    render(
      <SettingsModal
        open={true}
        userId="user123"
        buttonPosition={defaultButtonPosition}
        onClose={vi.fn()}
      />,
    );

    const saveButton = screen.getByText("Save");
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Firestore error");
    });
  });

  it("closes modal when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(
      <SettingsModal
        open={true}
        userId={null}
        buttonPosition={defaultButtonPosition}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it("does not close on Escape when saving", async () => {
    const onClose = vi.fn();
    vi.mocked(userPreferencesService.saveUserPreferencesToFirestore).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    render(
      <SettingsModal
        open={true}
        userId="user123"
        buttonPosition={defaultButtonPosition}
        onClose={onClose}
      />,
    );

    const saveButton = screen.getByText("Save");
    await act(async () => {
      fireEvent.click(saveButton);
    });

    // Try to escape while saving
    fireEvent.keyDown(document, { key: "Escape" });

    // Should not close while saving
    expect(onClose).not.toHaveBeenCalled();
  });

  it("positions modal correctly relative to button", () => {
    const buttonPosition = {
      top: 200,
      left: 100,
      width: 50,
      height: 50,
    };

    render(
      <SettingsModal
        open={true}
        userId={null}
        buttonPosition={buttonPosition}
        onClose={vi.fn()}
      />,
    );

    const modal = screen.getByRole("dialog");

    // Modal should be positioned to the right of the button
    expect(modal.style.left).toBe(`${buttonPosition.left + buttonPosition.width + 8}px`);
  });
});
