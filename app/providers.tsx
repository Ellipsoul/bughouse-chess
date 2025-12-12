"use client";

import { Toaster } from "react-hot-toast";
import React from "react";

/**
 * Top-level client providers. Currently hosts the toast system so all pages
 * can trigger notifications.
 */
export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Toaster
        position="bottom-left"
        toastOptions={{
          className: "text-base",
          duration: 4500,
          style: {
            background: "#1f2937",
            color: "#e5e7eb",
            border: "1px solid #374151",
          },
          success: {
            duration: 4000,
            iconTheme: {
              primary: "#34d399",
              secondary: "#0f172a",
            },
          },
          error: {
            duration: 5500,
            iconTheme: {
              primary: "#f87171",
              secondary: "#0f172a",
            },
          },
        }}
      />
      {children}
    </>
  );
}

