/**
 * @module usePieceValuePreset
 *
 * React hook that mirrors the capture-material preset stored in localStorage.
 */
"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_PIECE_VALUE_PRESET } from "@/app/utils/analysis/captureMaterial";
import {
  getPieceValuePresetSnapshot,
  subscribeToPieceValuePresetChanges,
} from "@/app/utils/preferences/userPreferencesService";

/**
 * Reactive view of the locally cached piece-value preset.
 *
 * The preference service emits a same-tab event when settings are saved and also
 * listens for browser storage events, so an open game updates without a reload.
 */
export function usePieceValuePreset() {
  return useSyncExternalStore(
    subscribeToPieceValuePresetChanges,
    getPieceValuePresetSnapshot,
    () => DEFAULT_PIECE_VALUE_PRESET,
  );
}
