"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import type { ChessGame } from "../actions";
import type { MatchGame } from "../types/match";
import type { SharedContentType, SingleGameData } from "../types/sharedGame";
import { SHARED_GAME_DESCRIPTION_MAX_LENGTH } from "../types/sharedGame";
import { shareGame, shareMatch } from "../utils/sharedGamesService";
import { ChessTitleBadge } from "./ChessTitleBadge";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface ShareGameModalProps {
  /**
   * Whether the modal is open.
   */
  open: boolean;

  /**
   * The user's Firebase Auth UID.
   */
  userId: string;

  /**
   * The user's username.
   */
  username: string;

  /**
   * Single game data to share (when not sharing a match).
   */
  singleGameData?: SingleGameData | null;

  /**
   * Match games to share (when sharing a match or partner games).
   */
  matchGames?: MatchGame[];

  /**
   * The type of content being shared.
   * Determines how the data is stored and displayed.
   */
  contentType: SharedContentType;

  /**
   * Called when the modal is closed (via cancel or after successful share).
   */
  onClose: () => void;

  /**
   * Called after a successful share with the new shared ID.
   */
  onSuccess?: (sharedId: string) => void;
}

/* -------------------------------------------------------------------------- */
/* Helper Components                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Displays a player name with optional chess title.
 */
function PlayerDisplay({
  username,
  chessTitle,
}: {
  username: string;
  chessTitle?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {chessTitle && <ChessTitleBadge chessTitle={chessTitle} />}
      <span className="font-medium">{username}</span>
    </span>
  );
}

/**
 * Extracts player information from a ChessGame for display.
 */
function getPlayersFromGame(
  original: ChessGame,
  partner: ChessGame | null,
): {
  team1: { player1: { username: string; chessTitle?: string }; player2: { username: string; chessTitle?: string } };
  team2: { player1: { username: string; chessTitle?: string }; player2: { username: string; chessTitle?: string } };
} {
  const aWhite = original.game.pgnHeaders.White;
  const aBlack = original.game.pgnHeaders.Black;
  const bWhite = partner?.game.pgnHeaders.White ?? "Unknown";
  const bBlack = partner?.game.pgnHeaders.Black ?? "Unknown";

  const aWhiteTitle = original.players.top.color === "white"
    ? original.players.top.chessTitle
    : original.players.bottom.chessTitle;
  const aBlackTitle = original.players.top.color === "black"
    ? original.players.top.chessTitle
    : original.players.bottom.chessTitle;
  const bWhiteTitle = partner?.players.top.color === "white"
    ? partner?.players.top.chessTitle
    : partner?.players.bottom.chessTitle;
  const bBlackTitle = partner?.players.top.color === "black"
    ? partner?.players.top.chessTitle
    : partner?.players.bottom.chessTitle;

  return {
    team1: {
      player1: { username: aWhite, chessTitle: aWhiteTitle },
      player2: { username: bBlack, chessTitle: bBlackTitle },
    },
    team2: {
      player1: { username: aBlack, chessTitle: aBlackTitle },
      player2: { username: bWhite, chessTitle: bWhiteTitle },
    },
  };
}

/**
 * Computes the result string for a single game.
 */
function getSingleGameResult(original: ChessGame): string {
  const winner = original.game.colorOfWinner;
  if (!winner) {
    return "½ - ½";
  }
  return winner === "white" ? "1 - 0" : "0 - 1";
}

/**
 * Computes the result string for a match (multiple games).
 */
function getMatchResult(matchGames: MatchGame[]): string {
  let team1Wins = 0;
  let team2Wins = 0;

  for (const game of matchGames) {
    const winner = game.original.game.colorOfWinner;
    if (winner === "white") {
      team1Wins++;
    } else if (winner === "black") {
      team2Wins++;
    }
  }

  return `${team1Wins} - ${team2Wins}`;
}

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Modal for sharing a game or match.
 * Displays a summary of the content being shared and allows adding a description.
 */
export default function ShareGameModal({
  open,
  userId,
  username,
  singleGameData,
  matchGames,
  contentType,
  onClose,
  onSuccess,
}: ShareGameModalProps) {
  const [description, setDescription] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const shareButtonRef = useRef<HTMLButtonElement | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setDescription("");
      setIsSharing(false);
      // Focus the textarea after a short delay to ensure the modal is rendered
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [open]);

  // Handle escape key
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSharing) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, isSharing, onClose]);

  const handleCancel = useCallback(() => {
    if (isSharing) return;
    setDescription("");
    onClose();
  }, [isSharing, onClose]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);

    try {
      let result;

      if (contentType === "game" && singleGameData) {
        result = await shareGame(userId, username, singleGameData, description);
      } else if ((contentType === "match" || contentType === "partnerGames") && matchGames && matchGames.length > 0) {
        result = await shareMatch(userId, username, matchGames, contentType, description);
      } else {
        toast.error("No valid content to share");
        setIsSharing(false);
        return;
      }

      if (result.success) {
        toast.success("Game shared successfully!");
        onSuccess?.(result.sharedId);
        onClose();
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      console.error("[ShareGameModal] Share failed:", err);
      const message = err instanceof Error ? err.message : "Failed to share";
      toast.error(message);
    } finally {
      setIsSharing(false);
    }
  }, [contentType, singleGameData, matchGames, userId, username, description, onSuccess, onClose]);

  if (!open) return null;

  // Determine content to display
  const isMatch = contentType === "match" || contentType === "partnerGames";
  const hasValidContent = isMatch
    ? matchGames && matchGames.length > 0
    : singleGameData?.original;

  if (!hasValidContent) {
    return null;
  }

  // Get display data
  const firstGame = isMatch && matchGames ? matchGames[0]! : null;
  const displayGame = isMatch
    ? { original: firstGame!.original, partner: firstGame!.partner }
    : { original: singleGameData!.original, partner: singleGameData!.partner };

  const players = getPlayersFromGame(displayGame.original, displayGame.partner);
  const result = isMatch && matchGames
    ? getMatchResult(matchGames)
    : getSingleGameResult(displayGame.original);
  const gameCount = isMatch && matchGames ? matchGames.length : 1;

  const contentTypeLabel = contentType === "match"
    ? "Match"
    : contentType === "partnerGames"
      ? "Partner Games"
      : "Game";

  const charactersRemaining = SHARED_GAME_DESCRIPTION_MAX_LENGTH - description.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={handleCancel}
        disabled={isSharing}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${contentTypeLabel}`}
        className="relative z-10 w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900 shadow-2xl"
      >
        <div className="p-5">
          {/* Header */}
          <div className="mb-4 text-base font-semibold tracking-wide text-gray-100">
            Share {contentTypeLabel}
          </div>

          {/* Game Summary */}
          <div className="mb-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            {/* Type and game count */}
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded bg-mariner-600/20 px-2 py-0.5 text-xs font-medium text-mariner-400">
                {contentTypeLabel}
              </span>
              {gameCount > 1 && (
                <span className="text-xs text-gray-400">
                  {gameCount} games
                </span>
              )}
            </div>

            {/* Players and result */}
            <div className="flex items-center justify-between gap-4 text-sm">
              {/* Team 1 */}
              <div className="flex flex-col gap-0.5 text-gray-200">
                <PlayerDisplay
                  username={players.team1.player1.username}
                  chessTitle={players.team1.player1.chessTitle}
                />
                <PlayerDisplay
                  username={players.team1.player2.username}
                  chessTitle={players.team1.player2.chessTitle}
                />
              </div>

              {/* Result */}
              <div className="text-center">
                <span className="text-lg font-bold text-gray-100">{result}</span>
              </div>

              {/* Team 2 */}
              <div className="flex flex-col items-end gap-0.5 text-gray-200">
                <PlayerDisplay
                  username={players.team2.player1.username}
                  chessTitle={players.team2.player1.chessTitle}
                />
                <PlayerDisplay
                  username={players.team2.player2.username}
                  chessTitle={players.team2.player2.chessTitle}
                />
              </div>
            </div>
          </div>

          {/* Description input */}
          <div className="mb-4">
            <label
              htmlFor="share-description"
              className="mb-1.5 block text-sm font-medium text-gray-200"
            >
              Description (optional)
            </label>
            <textarea
              ref={textareaRef}
              id="share-description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, SHARED_GAME_DESCRIPTION_MAX_LENGTH))}
              placeholder="Add a note about this game..."
              rows={2}
              className="w-full resize-none rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-400 outline-none transition-colors focus:border-mariner-400 focus:ring-1 focus:ring-mariner-500/50"
              disabled={isSharing}
            />
            <div className="mt-1 text-right text-xs text-gray-400">
              {charactersRemaining} characters remaining
            </div>
          </div>

          {/* Sharing as */}
          <div className="mb-4 text-sm text-gray-400">
            Sharing as <span className="font-medium text-gray-200">{username}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 hover:bg-gray-700/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleCancel}
              disabled={isSharing}
            >
              Cancel
            </button>
            <button
              ref={shareButtonRef}
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-mariner-600 px-3 py-2 text-sm font-semibold text-white hover:bg-mariner-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void handleShare()}
              disabled={isSharing}
            >
              {isSharing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {isSharing ? "Sharing..." : "Share"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
