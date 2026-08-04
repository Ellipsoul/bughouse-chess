"use client";

/**
 * @module app/components/modals/ConfirmLoadNewGameModal
 *
 * Replaces `window.confirm` when loading a new game would discard in-progress analysis.
 * Supports a persistent "Don't show again" preference via local storage.
 */
import React, { useEffect, useRef, useState } from "react";

export interface ConfirmLoadNewGameModalProps {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Human-readable label for the currently loaded game (shown in the warning copy). */
  existingLabel: string;
  /** Sanitized chess.com game id the user is attempting to load. */
  newGameId: string;
  /** Called when the user confirms; `dontShowAgain` reflects the checkbox state. */
  onConfirm: (options: { dontShowAgain: boolean }) => void;
  /** Called when the user cancels or presses Escape. */
  onCancel: () => void;
}

/**
 * Modal asking the user to confirm they want to load a new game which will overwrite
 * the currently loaded / modified analysis.
 *
 * This replaces the old `window.confirm(...)` flow with a richer UI that supports a
 * persistent "Don't show again" preference.
 */
export default function ConfirmLoadNewGameModal({
  open,
  existingLabel,
  newGameId,
  onConfirm,
  onCancel,
}: ConfirmLoadNewGameModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // Ensure the primary action is focusable for keyboard users.
    confirmButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  /** Dismiss dialog and reset ephemeral checkbox state. */
  const handleCancel = () => {
    // Reset so the next open starts from a clean slate even if this component
    // is rendered in a "hidden" state rather than unmounted.
    setDontShowAgain(false);
    onCancel();
  };

  /** Accept load and forward the "don't show again" preference to the parent. */
  const handleConfirm = () => {
    const choice = dontShowAgain;
    // Reset for the same reason as `handleCancel`.
    setDontShowAgain(false);
    onConfirm({ dontShowAgain: choice });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={handleCancel}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirm loading new game"
        className="relative z-10 w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900 shadow-2xl"
      >
        <div className="p-5">
          <div className="mb-2 text-sm font-semibold tracking-wide text-gray-100">
            Load new game?
          </div>

          <p className="text-sm text-gray-200 leading-relaxed">
            <span className="font-semibold">{existingLabel}</span> is already loaded/modified.
            <br />
            <br />
            Loading <span className="font-semibold">game {newGameId}</span> will replace all existing moves, variations, and position state.
          </p>

          <label className="mt-4 flex items-start gap-2 text-sm text-gray-200 select-none">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-emerald-500"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            <span>Don’t show again</span>
          </label>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 hover:bg-gray-700/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              ref={confirmButtonRef}
              type="button"
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
              onClick={handleConfirm}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
