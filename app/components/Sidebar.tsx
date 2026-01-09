"use client";

import Link from "next/link";
import Image from "next/image";
import React from "react";
import { Github, UserRound } from "lucide-react";
import { TooltipAnchor } from "./TooltipAnchor";
import { useAuth } from "../auth/useAuth";

const GITHUB_REPO_URL = "https://github.com/Ellipsoul/bughouse-chess";

/**
 * Slim, global left sidebar.
 *
 * Design goals:
 * - Minimal horizontal footprint (icon-first)
 * - Keyboard accessible controls
 * - Clear sign-in affordance via profile avatar state
 */
export default function Sidebar() {
  const { user, status } = useAuth();

  const avatarAlt =
    status === "signed_in" && user?.email ? `Profile avatar for ${user.email}` : "Profile";

  return (
    <aside
      className={[
        "h-full shrink-0",
        // Mobile-first: make the sidebar much narrower on small devices.
        "w-8 sm:w-14 md:w-16",
        "bg-mariner-950/55 border-r border-mariner-900/40",
        "flex flex-col items-center py-3",
      ].join(" ")}
      aria-label="App sidebar"
    >
      <div className="mt-auto flex flex-col items-center gap-2 pb-1">
        <TooltipAnchor content="View source code on GitHub">
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="View source code on GitHub"
            className={[
              "inline-flex items-center justify-center rounded-md",
              "h-8 w-8 sm:h-10 sm:w-10",
              "text-gray-200 hover:text-white hover:bg-gray-700/60 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900",
            ].join(" ")}
          >
            <Github className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          </a>
        </TooltipAnchor>

        <div className="w-6 sm:w-9 h-px bg-gray-700/70" aria-hidden="true" />

        <TooltipAnchor content="Profile">
          <Link
            href="/profile"
            aria-label="Open profile"
            className={[
              "inline-flex items-center justify-center rounded-full",
              "h-9 w-9 sm:h-11 sm:w-11",
              "bg-gray-900/40 border border-gray-700/60",
              "hover:bg-gray-800/60 hover:border-gray-600 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900",
            ].join(" ")}
          >
            {status === "signed_in" && user?.photoURL ? (
              <Image
                src={user.photoURL}
                alt={avatarAlt}
                width={40}
                height={40}
                className="rounded-full"
              />
            ) : (
              <UserRound className="h-4 w-4 sm:h-5 sm:w-5 text-gray-100" aria-hidden="true" />
            )}
          </Link>
        </TooltipAnchor>
      </div>
    </aside>
  );
}
