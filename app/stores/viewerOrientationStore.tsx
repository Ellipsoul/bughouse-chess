import React, { createContext, useContext } from "react";
import { makeAutoObservable } from "mobx";

/**
 * Local-only orientation state for a single Game Viewer session.
 *
 * This store is intentionally ephemeral: it should be created per loaded game/match
 * and discarded on new loads to prevent state leakage across sessions.
 */
export class ViewerOrientationStore {
  /**
   * Monotonic key representing the viewer session that owns this store.
   */
  sessionKey: number;
  isBoardOrderSwapped = false;

  constructor(sessionKey: number) {
    this.sessionKey = sessionKey;
    makeAutoObservable(this);
  }

  /**
   * Toggle the left/right board order.
   */
  toggleBoardOrder(): void {
    this.isBoardOrderSwapped = !this.isBoardOrderSwapped;
  }
}

const ViewerOrientationStoreContext = createContext<ViewerOrientationStore | null>(null);

/**
 * Provide a viewer-scoped orientation store.
 */
export function ViewerOrientationStoreProvider({
  store,
  children,
}: {
  store: ViewerOrientationStore;
  children: React.ReactNode;
}) {
  return (
    <ViewerOrientationStoreContext.Provider value={store}>
      {children}
    </ViewerOrientationStoreContext.Provider>
  );
}

/**
 * Access the current viewer orientation store.
 *
 * @throws if used outside the provider.
 */
export function useViewerOrientationStore(): ViewerOrientationStore {
  const ctx = useContext(ViewerOrientationStoreContext);
  if (!ctx) {
    throw new Error("useViewerOrientationStore must be used within <ViewerOrientationStoreProvider>");
  }
  return ctx;
}
