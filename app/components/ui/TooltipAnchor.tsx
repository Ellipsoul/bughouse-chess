"use client";

import React from "react";
import { APP_TOOLTIP_ID } from "../../utils/tooltips";

export interface TooltipAnchorProps {
  /** Tooltip text shown on hover/focus of the wrapped content. */
  content: string;
  /** The element(s) that should act as the tooltip anchor. */
  children: React.ReactNode;
  /** Optional extra classes for layout (e.g. sizing/position). */
  className?: string;
}

/**
 * Wraps UI controls (especially **disabled** buttons) with a React Tooltip anchor.
 *
 * Why wrap?
 * - Disabled `<button>` elements do not fire mouse events, so tooltips would not
 *   show if we attached tooltip attributes directly to the button.
 * - By attaching the tooltip to a non-disabled wrapper, we keep tooltips usable
 *   even when the control is disabled.
 */
export function TooltipAnchor({ content, children, className }: TooltipAnchorProps) {
  return (
    <span
      className={className ?? "inline-flex"}
      data-tooltip-id={APP_TOOLTIP_ID}
      data-tooltip-content={content}
    >
      {children}
    </span>
  );
}
