"use client";

import Link from "next/link";
import Image from "next/image";
import { BookMarked, ChessKnight, Github, UserRound } from "lucide-react";
import { TooltipAnchor } from "./TooltipAnchor";
import { useAuth } from "../auth/useAuth";

const GITHUB_REPO_URL = "https://github.com/Ellipsoul/bughouse-chess";
const CHESS_COM_BUGHOUSE_URL = "https://www.chess.com/play/online/doubles-bughouse";

/**
 * Responsive profile avatar that renders different sized images based on screen size.
 * Uses CSS display utilities to show/hide the appropriate size.
 *
 * Breakpoints match the sidebar width and profile container sizes:
 * - Default (< 768px): sidebar w-8 (32px), container h-6 w-6 (24px), avatar 20px
 * - md (768px+): sidebar w-10 (40px), container h-8 w-8 (32px), avatar 28px
 * - lg (1024px+): sidebar w-16 (64px), container h-11 w-11 (44px), avatar 40px
 */
function ProfileAvatar({ src, alt }: { src: string; alt: string }) {
  return (
    <>
      {/* Default (< 768px): 20px avatar in 24px container */}
      <Image
        loading="eager"
        src={src}
        alt={alt}
        width={20}
        height={20}
        className="rounded-full md:hidden"
      />
      {/* md (768px - 1023px): 28px avatar in 32px container */}
      <Image
        loading="eager"
        src={src}
        alt={alt}
        width={28}
        height={28}
        className="rounded-full hidden md:block lg:hidden"
      />
      {/* lg (1024px+): 40px avatar in 44px container */}
      <Image
        loading="eager"
        src={src}
        alt={alt}
        width={40}
        height={40}
        className="rounded-full hidden lg:block"
      />
    </>
  );
}

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
        "w-8 md:w-10 lg:w-16",
        "bg-slate-800 border-r border-slate-900",
        "flex flex-col items-center py-3",
      ].join(" ")}
      aria-label="App sidebar"
    >
      <div className="mt-auto flex flex-col items-center gap-2 pb-1">
        <TooltipAnchor content="Play bughouse on Chess.com">
          <Link
            href={CHESS_COM_BUGHOUSE_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Play bughouse on Chess.com"
            className={[
              "inline-flex items-center justify-center rounded-md",
              // Match sidebar breakpoints: w-8 (32px) -> w-10 (40px) -> w-16 (64px)
              "h-6 w-6 md:h-8 md:w-8 lg:h-10 lg:w-10",
              "text-gray-200 hover:text-white hover:bg-gray-700/60 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900",
            ].join(" ")}
          >
            <ChessKnight className="h-4 w-4 md:h-5 md:w-5 lg:h-6 lg:w-6" aria-hidden="true" />
          </Link>
        </TooltipAnchor>

        <TooltipAnchor content="Browse shared games">
          <Link
            href="/shared-games"
            aria-label="Browse shared games"
            className={[
              "inline-flex items-center justify-center rounded-md",
              // Match sidebar breakpoints: w-8 (32px) -> w-10 (40px) -> w-16 (64px)
              "h-6 w-6 md:h-8 md:w-8 lg:h-10 lg:w-10",
              "text-gray-200 hover:text-white hover:bg-gray-700/60 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900",
            ].join(" ")}
          >
            <BookMarked className="h-4 w-4 md:h-5 md:w-5 lg:h-6 lg:w-6" aria-hidden="true" />
          </Link>
        </TooltipAnchor>

        <TooltipAnchor content="View source code on GitHub">
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="View source code on GitHub"
            className={[
              "inline-flex items-center justify-center rounded-md",
              // Match sidebar breakpoints: w-8 (32px) -> w-10 (40px) -> w-16 (64px)
              "h-6 w-6 md:h-8 md:w-8 lg:h-10 lg:w-10",
              "text-gray-200 hover:text-white hover:bg-gray-700/60 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900",
            ].join(" ")}
          >
            <Github className="h-4 w-4 md:h-5 md:w-5 lg:h-6 lg:w-6" aria-hidden="true" />
          </a>
        </TooltipAnchor>

        <div className="w-5 md:w-7 lg:w-10 h-px bg-gray-700/70" aria-hidden="true" />

        <TooltipAnchor content="Profile">
          <Link
            href="/profile"
            aria-label="Open profile"
            className={[
              "inline-flex items-center justify-center rounded-full",
              // Match sidebar breakpoints: w-8 (32px) -> w-10 (40px) -> w-16 (64px)
              // Container sizes: 24px -> 32px -> 44px (with some padding from sidebar edge)
              "h-6 w-6 md:h-8 md:w-8 lg:h-11 lg:w-11",
              "bg-gray-900/40 border border-gray-700/60",
              "hover:bg-gray-800/60 hover:border-gray-600 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900",
            ].join(" ")}
          >
            {status === "signed_in" && user?.photoURL ? (
              <ProfileAvatar src={user.photoURL} alt={avatarAlt} />
            ) : (
              <UserRound className="h-3 w-3 md:h-4 md:w-4 lg:h-5 lg:w-5 text-gray-100" aria-hidden="true" />
            )}
          </Link>
        </TooltipAnchor>
      </div>
    </aside>
  );
}
