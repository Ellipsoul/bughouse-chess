"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

export interface DeleteConfirmationModalProps {
  /**
   * Whether the modal is open.
   */
  open: boolean;

  /**
   * Title of the modal.
   */
  title: string;

  /**
   * Description/message explaining what will be deleted.
   */
  message: string;

  /**
   * Whether a delete operation is in progress.
   */
  isDeleting?: boolean;

  /**
   * Text for the confirm button.
   * @default "Delete"
   */
  confirmText?: string;

  /**
   * Text for the cancel button.
   * @default "Cancel"
   */
  cancelText?: string;

  /**
   * Called when the user confirms the deletion.
   */
  onConfirm: () => void;

  /**
   * Called when the user cancels or closes the modal.
   */
  onCancel: () => void;
}

/**
 * Reusable modal for confirming destructive actions.
 * Features a warning icon and red-themed confirm button to emphasize the action.
 */
export default function DeleteConfirmationModal({
  open,
  title,
  message,
  isDeleting = false,
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: DeleteConfirmationModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  // Focus cancel button when modal opens (safer default for destructive actions)
  useEffect(() => {
    if (!open) return;
    cancelButtonRef.current?.focus();
  }, [open]);

  // Handle escape key
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, isDeleting, onCancel]);

  const handleCancel = useCallback(() => {
    if (isDeleting) return;
    onCancel();
  }, [isDeleting, onCancel]);

  const handleConfirm = useCallback(() => {
    if (isDeleting) return;
    onConfirm();
  }, [isDeleting, onConfirm]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={handleCancel}
        disabled={isDeleting}
      />

      {/* Dialog */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        aria-describedby="delete-modal-description"
        className="relative z-10 w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 shadow-2xl"
      >
        <div className="p-5">
          {/* Warning icon and title */}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden />
            </div>
            <div>
              <h2
                id="delete-modal-title"
                className="text-base font-semibold text-gray-100"
              >
                {title}
              </h2>
              <p
                id="delete-modal-description"
                className="mt-2 text-sm text-gray-300 leading-relaxed"
              >
                {message}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              ref={cancelButtonRef}
              type="button"
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 hover:bg-gray-700/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleCancel}
              disabled={isDeleting}
            >
              {cancelText}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleConfirm}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {isDeleting ? "Deleting..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
