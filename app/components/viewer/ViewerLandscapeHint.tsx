"use client";

import { RotateCw, Smartphone } from "lucide-react";

/**
 * Small, non-blocking corner chip suggesting landscape on phone portrait viewports.
 *
 * Parent should only mount this when {@link usePhonePortraitLandscapeHint} is active.
 */
export default function ViewerLandscapeHint() {
  return (
    <div
      className={[
        "pointer-events-none fixed z-30 max-w-[min(18rem,calc(100vw-1.5rem))] select-none",
        "bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))]",
        "right-[max(0.75rem,env(safe-area-inset-right,0px))]",
      ].join(" ")}
      role="status"
    >
      <div
        className={[
          "flex items-start gap-2 rounded-md border border-gray-700 bg-gray-900/85 px-3 py-2",
          "text-xs leading-snug text-gray-200 shadow-lg backdrop-blur",
        ].join(" ")}
      >
        <span className="mt-0.5 inline-flex shrink-0 gap-1 text-gray-400" aria-hidden="true">
          <Smartphone className="h-3.5 w-3.5" />
          <RotateCw className="h-3.5 w-3.5" />
        </span>
        <span>Tip: rotate your phone for the best layout.</span>
      </div>
    </div>
  );
}
