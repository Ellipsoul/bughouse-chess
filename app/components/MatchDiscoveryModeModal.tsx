"use client";

import React, { useEffect, useRef } from "react";
import { Users, UserCheck } from "lucide-react";
import type { PartnerPair, DiscoveryMode } from "../types/match";
import { useCompactLandscape } from "../utils/useCompactLandscape";

/**
 * Result of the discovery mode selection.
 */
export interface DiscoveryModeSelection {
  /** The selected discovery mode. */
  mode: DiscoveryMode;
  /** The selected partner pair (only for "partnerPair" mode). */
  selectedPair?: PartnerPair;
}

export interface MatchDiscoveryModeModalProps {
  /** Whether the modal is open. */
  open: boolean;
  /** The two partner pairs from the currently loaded game. */
  partnerPairs: [PartnerPair, PartnerPair] | null;
  /** Callback when user selects a discovery mode. */
  onSelect: (selection: DiscoveryModeSelection) => void;
  /** Callback when user cancels the modal. */
  onCancel: () => void;
}

/**
 * Modal for selecting match discovery mode.
 *
 * Presents the user with options to:
 * - Find a full match (all 4 players)
 * - Find games where a specific partner pair played together
 * - Cancel
 */
export default function MatchDiscoveryModeModal({
  open,
  partnerPairs,
  onSelect,
  onCancel,
}: MatchDiscoveryModeModalProps) {
  const fullMatchButtonRef = useRef<HTMLButtonElement | null>(null);
  const isCompact = useCompactLandscape();

  // Focus the primary action on open
  useEffect(() => {
    if (!open) return;
    fullMatchButtonRef.current?.focus();
  }, [open]);

  // Handle Escape key
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

  const handleFullMatch = () => {
    onSelect({ mode: "fullMatch" });
  };

  const handlePartnerPair = (pair: PartnerPair) => {
    onSelect({ mode: "partnerPair", selectedPair: pair });
  };

  // Compact styles for phone landscape mode
  const dialogClassName = isCompact
    ? "relative z-10 w-64 max-w-[calc(100vw-1rem)] max-h-[calc(100vh-1rem)] overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-2xl"
    : "relative z-10 w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 shadow-2xl";

  const containerClassName = isCompact ? "p-2" : "p-5";

  const titleClassName = isCompact
    ? "mb-1 text-[10px] font-semibold tracking-wide text-gray-100"
    : "mb-4 text-sm font-semibold tracking-wide text-gray-100";

  const optionsSpacingClassName = isCompact ? "space-y-1" : "space-y-3";

  const buttonClassName = isCompact
    ? "w-full flex items-center gap-1.5 p-1.5 rounded-md border border-gray-600 bg-gray-800/60 hover:bg-gray-700/80 hover:border-gray-500 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60"
    : "w-full flex items-center gap-3 p-3 rounded-lg border border-gray-600 bg-gray-800/60 hover:bg-gray-700/80 hover:border-gray-500 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60";

  const iconClassName = isCompact ? "h-3.5 w-3.5 shrink-0" : "h-5 w-5 shrink-0";

  const labelClassName = isCompact
    ? "text-[10px] font-medium text-gray-100"
    : "text-sm font-medium text-gray-100";

  const descriptionClassName = isCompact
    ? "text-[8px] text-gray-400 leading-tight"
    : "text-xs text-gray-400 leading-tight";

  const sectionLabelClassName = isCompact
    ? "text-[8px] text-gray-500 uppercase tracking-wider pt-0.5"
    : "text-xs text-gray-500 uppercase tracking-wider pt-2";

  const cancelButtonClassName = isCompact
    ? "rounded border border-gray-700 bg-gray-800 px-2 py-0.5 text-[9px] text-gray-100 hover:bg-gray-700/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
    : "rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 hover:bg-gray-700/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50";

  const cancelContainerClassName = isCompact ? "mt-1.5 flex justify-end" : "mt-5 flex justify-end";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-2">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Select match discovery mode"
        className={dialogClassName}
      >
        <div className={containerClassName}>
          {/* Title */}
          <div className={titleClassName}>Find Match Games</div>

          {/* Options */}
          <div className={optionsSpacingClassName}>
            {/* Full Match Option */}
            <button
              ref={fullMatchButtonRef}
              type="button"
              onClick={handleFullMatch}
              className={buttonClassName}
            >
              <Users className={`${iconClassName} text-mariner-400`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className={labelClassName}>Full Match (4 Players)</div>
                <div className={descriptionClassName}>All four players are the same</div>
              </div>
            </button>

            {/* Partner Pair Options */}
            {partnerPairs && (
              <>
                <div className={sectionLabelClassName}>Partner Series</div>

                {partnerPairs.map((pair, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handlePartnerPair(pair)}
                    className={buttonClassName}
                  >
                    <UserCheck className={`${iconClassName} text-emerald-400`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className={`${labelClassName} truncate`}>
                        {pair.displayNames[0]} & {pair.displayNames[1]}
                      </div>
                      <div className={descriptionClassName}>These two partnered together</div>
                    </div>
                  </button>
                ))}
              </>
            )}

            {!partnerPairs && (
              <div className={`${descriptionClassName} p-2 bg-gray-800/40 rounded-md border border-gray-700`}>
                Partner pair options require both boards to be loaded.
              </div>
            )}
          </div>

          {/* Cancel button */}
          <div className={cancelContainerClassName}>
            <button type="button" className={cancelButtonClassName} onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
