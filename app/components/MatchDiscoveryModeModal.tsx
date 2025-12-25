"use client";

import React, { useEffect, useRef } from "react";
import { Users, UserCheck } from "lucide-react";
import type { PartnerPair, DiscoveryMode } from "../types/match";

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-2 sm:px-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={onCancel}
      />

      {/* Dialog - responsive sizing */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Select match discovery mode"
        className="relative z-10 w-full max-w-[calc(100vw-1rem)] sm:max-w-md rounded-lg sm:rounded-xl border border-gray-700 bg-gray-900 shadow-2xl"
      >
        <div className="p-3 sm:p-5">
          <div className="mb-2 sm:mb-4 text-xs sm:text-sm font-semibold tracking-wide text-gray-100">
            Find Match Games
          </div>

          <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-3 sm:mb-5">
            What type of game series would you like to find?
          </p>

          <div className="space-y-2 sm:space-y-3">
            {/* Full Match Option */}
            <button
              ref={fullMatchButtonRef}
              type="button"
              onClick={handleFullMatch}
              className="w-full flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-md sm:rounded-lg border border-gray-600 bg-gray-800/60 hover:bg-gray-700/80 hover:border-gray-500 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60"
            >
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-mariner-400 mt-0.5 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-medium text-gray-100">Full Match (4 Players)</div>
                <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
                  Find games where all four players are the same
                </div>
              </div>
            </button>

            {/* Partner Pair Options */}
            {partnerPairs && (
              <>
                <div className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider pt-1 sm:pt-2">
                  Partner Series
                </div>

                {partnerPairs.map((pair, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handlePartnerPair(pair)}
                    className="w-full flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-md sm:rounded-lg border border-gray-600 bg-gray-800/60 hover:bg-gray-700/80 hover:border-gray-500 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60"
                  >
                    <UserCheck
                      className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400 mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-medium text-gray-100 truncate">
                        {pair.displayNames[0]} & {pair.displayNames[1]}
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
                        Find games where these two partnered together
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}

            {!partnerPairs && (
              <div className="text-[10px] sm:text-xs text-gray-500 p-2 sm:p-3 bg-gray-800/40 rounded-md sm:rounded-lg border border-gray-700">
                Partner pair options require both boards to be loaded.
              </div>
            )}
          </div>

          {/* Cancel button */}
          <div className="mt-3 sm:mt-5 flex justify-end">
            <button
              type="button"
              className="rounded-md border border-gray-700 bg-gray-800 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm text-gray-100 hover:bg-gray-700/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
