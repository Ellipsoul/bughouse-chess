"use client";

import React from "react";

/**
 * Chess.com-style chess titles.
 *
 * Note: Chess.com omits the field entirely for untitled players, so callers should pass
 * the raw `chessTitle` string (or undefined) and this component will no-op when absent.
 */
export type ChessTitle =
  | "NM"
  | "CM"
  | "WCM"
  | "FM"
  | "WFM"
  | "IM"
  | "WIM"
  | "GM"
  | "WGM";

type ChessTitleStyle = {
  className: string;
};

const TITLE_STYLE: Record<ChessTitle, ChessTitleStyle> = {
  // Belt-style palette (unique per title), tuned for readable contrast.
  // Requested mapping:
  // NM: White (black text)
  // WCM: Yellow (black text)
  // WFM: Orange (black text)
  // CM: Green (white text)
  // WIM: Purple (white text)
  // FM: Blue (white text)
  // WGM: Brown (white text)
  // IM: Red (white text)
  // GM: Black (white text)

  NM: { className: "bg-white text-black border border-black/20" },
  WCM: { className: "bg-yellow-300 text-black border border-black/15" },
  WFM: { className: "bg-orange-400 text-black border border-black/15" },
  CM: { className: "bg-emerald-600 text-white border border-white/20" },
  WIM: { className: "bg-purple-600 text-white border border-white/20" },
  FM: { className: "bg-blue-600 text-white border border-white/20" },
  // Gentle “brown” (less harsh than pure brown, still clearly distinct).
  WGM: { className: "bg-amber-800 text-white border border-white/20" },
  IM: { className: "bg-red-600 text-white border border-white/20" },
  GM: { className: "bg-black text-white border border-white/20" },
};

const FALLBACK_STYLE: ChessTitleStyle = {
  className: "bg-gray-600 text-white border border-white/20",
};

function normalizeChessTitle(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toUpperCase();
}

function isChessTitle(value: string): value is ChessTitle {
  return Object.prototype.hasOwnProperty.call(TITLE_STYLE, value);
}

export interface ChessTitleBadgeProps {
  /**
   * Raw chess title string from chess.com (e.g. "GM").
   * When undefined/empty, the badge is not rendered.
   */
  chessTitle?: string;
  /**
   * Optional extra classes for layout tweaks at call sites.
   */
  className?: string;
}

/**
 * Small badge shown to the left of a player's username when they have a chess title.
 * Styled to look similar to chess.com, with title-specific background colors.
 */
export function ChessTitleBadge({ chessTitle, className }: ChessTitleBadgeProps): React.ReactNode {
  const normalized = normalizeChessTitle(chessTitle);
  if (!normalized) return null;

  const style = isChessTitle(normalized) ? TITLE_STYLE[normalized] : FALLBACK_STYLE;

  return (
    <span
      aria-label={`Chess title: ${normalized}`}
      title={`Chess title: ${normalized}`}
      className={[
        "inline-flex items-center justify-center rounded-[3px] px-1 py-[1px]",
        "text-[9px] leading-none font-extrabold tracking-tight",
        style.className,
        className ?? "",
      ].join(" ")}
    >
      {normalized}
    </span>
  );
}
