"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { TwitterPicker, type ColorResult } from "react-color";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  getBoardAnnotationColorFromLocalStorage,
  saveBoardAnnotationColorToLocalStorage,
  removeBoardAnnotationColorFromLocalStorage,
  saveUserPreferencesToFirestore,
  DEFAULT_BOARD_ANNOTATION_COLOR,
  type UserPreferences,
} from "../utils/userPreferencesService";
import { useFirebaseAnalytics, logAnalyticsEvent } from "../utils/useFirebaseAnalytics";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Default color options for the Twitter Picker.
 * Includes the default light green as the first option.
 */
const DEFAULT_COLORS = [
  "#34A853", // Default light green (rgb(52, 168, 83))
  "#3B82F6", // Blue
  "#EF4444", // Red
  "#F59E0B", // Amber
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#10B981", // Emerald
  "#06B6D4", // Cyan
  "#F97316", // Orange
  "#6366F1", // Indigo
  "#14B8A6", // Teal
  "#A855F7", // Violet
];

/**
 * Converts a color string (hex or rgb) to hex format for the color picker.
 */
function normalizeColorToHex(color: string): string {
  // If it's already a hex color, return it
  if (color.startsWith("#")) {
    return color;
  }

  // If it's an rgb/rgba string, extract the RGB values
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]!, 10).toString(16).padStart(2, "0");
    const g = parseInt(rgbMatch[2]!, 10).toString(16).padStart(2, "0");
    const b = parseInt(rgbMatch[3]!, 10).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }

  // Fallback to default
  return DEFAULT_COLORS[0]!;
}

/**
 * Converts a hex color to rgb format with opacity for CSS variable.
 */
function hexToRgbWithOpacity(hex: string, opacity: number = 0.95): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b}, ${opacity})`;
}

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface SettingsModalProps {
  /**
   * Whether the modal is open.
   */
  open: boolean;

  /**
   * The user's Firebase Auth UID (null for non-authenticated users).
   */
  userId: string | null;

  /**
   * Position of the settings button (for positioning the popout).
   */
  buttonPosition: { top: number; left: number; width: number; height: number };

  /**
   * Called when the modal is closed (via cancel, save, or click-away).
   */
  onClose: () => void;
}

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Settings modal that allows users to customize board annotation color.
 * Opens as a popout next to the settings icon.
 */
export default function SettingsModal({
  open,
  userId,
  buttonPosition,
  onClose,
}: SettingsModalProps) {
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_BOARD_ANNOTATION_COLOR);
  const [initialColor, setInitialColor] = useState<string>(DEFAULT_BOARD_ANNOTATION_COLOR);
  const [isSaving, setIsSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const [modalHeight, setModalHeight] = useState<number | null>(null);
  const analytics = useFirebaseAnalytics();

  /**
   * Handles color selection from the Twitter Picker.
   */
  const handleColorChange = useCallback((color: ColorResult) => {
    const hexColor = color.hex;
    // Convert to rgb with opacity for CSS variable
    const rgbColor = hexToRgbWithOpacity(hexColor, 0.95);
    setSelectedColor(rgbColor);

    // Log analytics for color change (throttled by Firebase Analytics)
    logAnalyticsEvent(analytics, "settings_color_changed", {
      color_hex: hexColor,
    });
  }, [analytics]);

  /**
   * Reverts to the initial color and closes the modal.
   */
  const handleCancel = useCallback(() => {
    if (isSaving) return;

    // Revert CSS variable to initial color
    const root = document.documentElement;
    root.style.setProperty("--bh-board-annotation-color", initialColor);

    // Revert localStorage
    if (initialColor === DEFAULT_BOARD_ANNOTATION_COLOR) {
      removeBoardAnnotationColorFromLocalStorage();
    } else {
      saveBoardAnnotationColorToLocalStorage(initialColor);
    }

    onClose();
  }, [isSaving, initialColor, onClose]);

  /**
   * Saves the preference to Firestore (if authenticated) and closes the modal.
   */
  const handleSave = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);

    try {
      // If authenticated, save to Firestore
      if (userId) {
        const preferences: UserPreferences = {
          boardAnnotationColor: selectedColor,
        };
        await saveUserPreferencesToFirestore(userId, preferences);
        toast.success("Settings saved!");

        // Log analytics for successful save
        logAnalyticsEvent(analytics, "settings_saved", {
          user_authenticated: "true",
          color_changed: selectedColor !== initialColor ? "true" : "false",
          storage_type: "firestore",
        });
      } else {
        // For non-authenticated users, localStorage is already updated in real-time
        toast.success("Settings saved!");

        // Log analytics for successful save
        logAnalyticsEvent(analytics, "settings_saved", {
          user_authenticated: "false",
          color_changed: selectedColor !== initialColor ? "true" : "false",
          storage_type: "localStorage",
        });
      }

      // Update initial color to the saved color
      setInitialColor(selectedColor);
      onClose();
    } catch (err) {
      console.error("[SettingsModal] Failed to save preferences:", err);
      const message = err instanceof Error ? err.message : "Failed to save settings";

      // Log analytics for save error
      logAnalyticsEvent(analytics, "settings_save_error", {
        user_authenticated: userId ? "true" : "false",
        error: message,
      });

      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, userId, selectedColor, initialColor, onClose, analytics]);

  // Load initial color when modal opens
  useEffect(() => {
    if (open) {
      logAnalyticsEvent(analytics, "settings_modal_opened", {
        user_authenticated: userId ? "true" : "false",
      });
      const currentColor = getBoardAnnotationColorFromLocalStorage();
      setSelectedColor(currentColor);
      setInitialColor(currentColor);
      setIsSaving(false);
    }
  }, [open, analytics, userId]);

  // Measure modal height after render to calculate bottom alignment
  useEffect(() => {
    if (open && modalRef.current) {
      const height = modalRef.current.offsetHeight;
      setModalHeight(height);
    } else {
      setModalHeight(null);
    }
  }, [open, selectedColor]); // Re-measure if content changes

  // Update CSS variable in real-time as user selects color
  useEffect(() => {
    if (open) {
      const root = document.documentElement;
      root.style.setProperty("--bh-board-annotation-color", selectedColor);
      // Save to localStorage in real-time
      saveBoardAnnotationColorToLocalStorage(selectedColor);
    }
  }, [open, selectedColor, initialColor, analytics]);

  // Handle escape key
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) {
        e.preventDefault();
        handleCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, isSaving, handleCancel]);

  // Handle click outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        // Check if click was on the settings button (which should toggle, so don't close)
        const target = e.target as HTMLElement;
        const isSettingsButton = target.closest('[aria-label="Settings"]');
        if (!isSettingsButton) {
          handleCancel();
        }
      }
    };
    // Use capture phase to catch clicks before they bubble
    document.addEventListener("mousedown", handleClickOutside, true);
    return () => document.removeEventListener("mousedown", handleClickOutside, true);
  }, [open, handleCancel]);

  if (!open) return null;

  // Calculate popout position (to the right of the settings button)
  // Align bottom of modal with bottom of button
  const popoutLeft = buttonPosition.left + buttonPosition.width + 8;
  const popoutTop = modalHeight !== null
    ? buttonPosition.top + buttonPosition.height - modalHeight
    : buttonPosition.top; // Fallback to top alignment until height is measured

  // Hide modal until position is calculated to prevent jumping
  const isPositioned = modalHeight !== null;

  return (
    <>
      {/* Backdrop (invisible, just for click-away detection) */}
      <div className="fixed inset-0 z-40" aria-hidden="true" />

      {/* Popout Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="fixed z-50 rounded-lg border border-gray-700 bg-gray-900 shadow-2xl"
        style={{
          left: `${popoutLeft}px`,
          top: `${popoutTop}px`,
          minWidth: "240px",
          visibility: isPositioned ? "visible" : "hidden",
        }}
      >
        <div className="p-3">
          {/* Header */}
          <div className="mb-2 text-xs font-semibold tracking-wide text-gray-100">
            Settings
          </div>

          {/* Board Annotation Color Section */}
          <div className="mb-3" data-testid="annotation-color-picker">
            <label className="mb-1.5 block text-xs font-medium text-gray-300">
              Board Annotation Color
            </label>
            <TwitterPicker
              color={normalizeColorToHex(selectedColor)}
              onChange={handleColorChange}
              colors={DEFAULT_COLORS}
              triangle="hide"
              width="100%"
              styles={{
                default: {
                  card: {
                    background: "#364153",
                    boxShadow: "none",
                  },
                  input: {
                    background: "#1f2937",
                    color: "#f3f4f6",
                    borderColor: "#374151",
                  },
                },
              }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs text-gray-100 hover:bg-gray-700/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md bg-mariner-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-mariner-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void handleSave()}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
