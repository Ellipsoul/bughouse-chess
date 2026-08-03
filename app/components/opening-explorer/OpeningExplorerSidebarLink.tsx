"use client";

import Link from "next/link";
import { GitFork } from "lucide-react";
import { TooltipAnchor } from "../ui/TooltipAnchor";
export function OpeningExplorerSidebarLink() {
  return (
    <TooltipAnchor content="Opening explorer">
      <Link
        href="/opening-explorer"
        aria-label="Opening explorer"
        className={[
          "inline-flex items-center justify-center rounded-md",
          "h-6 w-6 md:h-8 md:w-8 lg:h-10 lg:w-10",
          "text-gray-200 hover:text-white hover:bg-gray-700/60 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900",
        ].join(" ")}
      >
        <GitFork className="h-4 w-4 md:h-5 md:w-5 lg:h-6 lg:w-6" aria-hidden="true" />
      </Link>
    </TooltipAnchor>
  );
}
