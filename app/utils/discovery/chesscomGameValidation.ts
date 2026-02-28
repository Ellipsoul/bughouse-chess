/**
 * Shared validation helpers for Chess.com "live game" payloads.
 *
 * Keep this file free of `"use server"` / `"use client"` so it can be used from both:
 * - server actions (for defensive checks)
 * - client components (for user-facing errors)
 */

/**
 * Minimal shape of a Chess.com live-game payload for type validation.
 * We intentionally keep this decoupled from `app/actions.ts` so this utility
 * remains importable from any module without triggering Next.js server-action rules.
 */
export type ChessComLiveGameTypeValidationPayload = {
  game?: {
    type?: unknown;
    typeName?: unknown;
  } | null;
} | null;

/**
 * Returns `null` when the payload represents a Bughouse game; otherwise returns a
 * user-facing error message.
 *
 * @param payload - Chess.com live game payload (or null).
 * @returns `null` if Bughouse; otherwise a user-friendly error message.
 */
export function getNonBughouseGameErrorMessage(
  payload: ChessComLiveGameTypeValidationPayload,
): string | null {
  const rawType = payload?.game?.type;
  if (rawType === "bughouse") return null;

  const typeName =
    typeof payload?.game?.typeName === "string" ? payload.game.typeName : null;

  // Prefer a friendly name if Chess.com provides one; otherwise fall back to the raw type.
  const prettyType =
    typeName ??
    (typeof rawType === "string" && rawType.trim().length > 0 ? rawType : "unknown");

  return `This game is not a Bughouse game (variant: ${prettyType}). Please provide a Bughouse game ID.`;
}
