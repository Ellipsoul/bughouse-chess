"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import {
  isUsernameAvailable,
  reserveUsername,
  validateUsername,
  normalizeUsername,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
} from "../utils/usernameService";
import { useFirebaseAnalytics, logAnalyticsEvent } from "../utils/useFirebaseAnalytics";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface UsernameReservationModalProps {
  /** Whether the modal is open. */
  isOpen: boolean;
  /** Called when the modal should close. */
  onClose: () => void;
  /** The Firebase Auth UID of the current user. */
  userId: string;
  /** Called when the username is successfully reserved. */
  onSuccess: (username: string) => void;
}

/** Possible states for username availability checking. */
type AvailabilityStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "invalid";

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Modal for reserving a username.
 *
 * Features:
 * - Input validation (3+ chars, alphanumeric + underscores)
 * - Debounced availability checking (1 second after typing stops)
 * - Warning that username cannot be changed later
 * - Race condition handling on submit
 */
export function UsernameReservationModal({
  isOpen,
  onClose,
  userId,
  onSuccess,
}: UsernameReservationModalProps) {
  const [username, setUsername] = useState("");
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analytics = useFirebaseAnalytics();

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the modal is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setUsername("");
      setAvailabilityStatus("idle");
      setValidationError(null);
      setIsSubmitting(false);
      setSubmitError(null);
    }
  }, [isOpen]);

  // Debounced availability check
  const checkAvailability = useCallback(async (value: string) => {
    // Validate first
    const error = validateUsername(value);
    if (error) {
      setValidationError(error);
      setAvailabilityStatus("invalid");
      return;
    }

    setValidationError(null);
    setAvailabilityStatus("checking");

    try {
      const available = await isUsernameAvailable(value);
      setAvailabilityStatus(available ? "available" : "taken");
    } catch (err) {
      console.error("[UsernameReservationModal] Availability check failed:", err);
      setAvailabilityStatus("idle");
      setValidationError("Failed to check availability. Please try again.");
    }
  }, []);

  // Handle input change with debouncing
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setUsername(value);
      setSubmitError(null);

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Reset to idle if empty
      if (!value.trim()) {
        setAvailabilityStatus("idle");
        setValidationError(null);
        return;
      }

      // Immediately show "checking" status for instant feedback.
      // This gives the user visual confirmation that we're verifying their input,
      // even though the actual API call is debounced.
      setAvailabilityStatus("checking");
      setValidationError(null);

      // Set new debounce timer (1 second)
      debounceTimerRef.current = setTimeout(() => {
        checkAvailability(value);
      }, 1000);
    },
    [checkAvailability],
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (availabilityStatus !== "available" || isSubmitting) {
        return;
      }

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        const result = await reserveUsername(userId, username);

        if (result.success) {
          const normalizedUsername = normalizeUsername(username);
          logAnalyticsEvent(analytics, "username_reserved", {
            username_length: normalizedUsername.length,
          });
          onSuccess(normalizedUsername);
          onClose();
        } else {
          // Log analytics for reservation failure
          logAnalyticsEvent(analytics, "username_reservation_error", {
            reason: result.reason ?? "unknown",
            error: result.message,
          });

          // Handle specific failure reasons
          if (result.reason === "username_taken") {
            setAvailabilityStatus("taken");
            setSubmitError("This username was just taken. Please choose another.");
          } else if (result.reason === "user_already_has_username") {
            setSubmitError("You have already set a username.");
          } else {
            setSubmitError(result.message);
          }
        }
      } catch (err) {
        console.error("[UsernameReservationModal] Submit failed:", err);
        setSubmitError("An unexpected error occurred. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [availabilityStatus, isSubmitting, userId, username, onSuccess, onClose, analytics],
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !isSubmitting) {
        onClose();
      }
    },
    [onClose, isSubmitting],
  );

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) {
    return null;
  }

  const canSubmit = availabilityStatus === "available" && !isSubmitting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="username-modal-title"
    >
      <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 id="username-modal-title" className="text-lg font-semibold text-gray-100">
            Choose Your Username
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Warning notice */}
          <div className="flex items-start gap-3 p-3 bg-amber-900/30 border border-amber-700/50 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200">
              <strong>Important:</strong> Your username can only be set once and cannot be changed
              later. Choose wisely!
            </p>
          </div>

          {/* Username input */}
          <div className="space-y-2">
            <label htmlFor="username-input" className="block text-sm font-medium text-gray-300">
              Username
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                id="username-input"
                type="text"
                value={username}
                onChange={handleInputChange}
                placeholder="Enter your username"
                disabled={isSubmitting}
                minLength={USERNAME_MIN_LENGTH}
                maxLength={USERNAME_MAX_LENGTH}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className={[
                  "w-full px-4 py-2.5 pr-10 rounded-lg",
                  "bg-gray-900 border text-gray-100 placeholder-gray-500",
                  "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  availabilityStatus === "available"
                    ? "border-green-500 focus:ring-green-500/60"
                    : availabilityStatus === "taken" || availabilityStatus === "invalid"
                      ? "border-red-500 focus:ring-red-500/60"
                      : "border-gray-600 focus:ring-mariner-400/60",
                ].join(" ")}
              />
              {/* Status indicator */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {availabilityStatus === "checking" && (
                  <Loader2 className="h-5 w-5 text-gray-400 animate-spin" aria-label="Checking availability" />
                )}
                {availabilityStatus === "available" && (
                  <Check className="h-5 w-5 text-green-400" aria-label="Username available" />
                )}
                {availabilityStatus === "taken" && (
                  <X className="h-5 w-5 text-red-400" aria-label="Username taken" />
                )}
              </div>
            </div>

            {/* Validation/availability message */}
            <div className="min-h-[20px]">
              {validationError && (
                <p className="text-sm text-red-400">{validationError}</p>
              )}
              {availabilityStatus === "available" && !validationError && (
                <p className="text-sm text-green-400">Username is available!</p>
              )}
              {availabilityStatus === "taken" && !validationError && (
                <p className="text-sm text-red-400">This username is already taken</p>
              )}
              {availabilityStatus === "checking" && !validationError && (
                <p className="text-sm text-gray-400">Checking availability...</p>
              )}
            </div>
          </div>

          {/* Submit error */}
          {submitError && (
            <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
              <p className="text-sm text-red-300">{submitError}</p>
            </div>
          )}

          {/* Guidelines */}
          <div className="text-xs text-gray-500 space-y-1">
            <p>Username requirements:</p>
            <ul className="list-disc list-inside pl-2 space-y-0.5">
              <li>{USERNAME_MIN_LENGTH}-{USERNAME_MAX_LENGTH} characters</li>
              <li>Letters, numbers, and underscores only</li>
              <li>Case-insensitive (stored as lowercase)</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={[
                "flex-1 px-4 py-2.5 rounded-lg",
                "border border-gray-600 bg-gray-700/50",
                "text-gray-200 font-medium text-sm",
                "hover:bg-gray-700 transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={[
                "flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg",
                "bg-mariner-600 border border-mariner-500",
                "text-white font-medium text-sm",
                "hover:bg-mariner-500 transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-mariner-400/60 focus:ring-offset-2 focus:ring-offset-gray-800",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-mariner-600",
              ].join(" ")}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Reserving...
                </>
              ) : (
                "Reserve Username"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
