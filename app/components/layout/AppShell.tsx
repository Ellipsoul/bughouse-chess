"use client";

import React from "react";
import Sidebar from "./Sidebar";

export interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Global application chrome.
 *
 * This wraps all pages with the persistent left sidebar while preserving the
 * app’s invariant of **no document scrolling**:
 * - The left sidebar is fixed-width and non-scrolling.
 * - The right content region is responsible for its own internal overflow.
 */
export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative flex h-full w-full overflow-hidden">
      <Sidebar />
      {/* The content region fills the remaining space. Pages with fixed headers (like the
          game viewer) handle their own internal layout and z-index stacking. */}
      <div className="relative flex-1 min-w-0 h-full">{children}</div>
    </div>
  );
}
