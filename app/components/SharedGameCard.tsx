"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import type { SharedGameSummary } from "../types/sharedGame";
import { deleteSharedGame } from "../utils/sharedGamesService";
import { ChessTitleBadge } from "./ChessTitleBadge";
import DeleteConfirmationModal from "./DeleteConfirmationModal";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface SharedGameCardProps {
  /**
   * The shared game summary to display.
   * Card only needs metadata, not full game data.
   */
  game: SharedGameSummary;

  /**
   * The current user's ID (for determining if delete button should show).
   */
  currentUserId?: string | null;

  /**
   * Called when the game is successfully deleted.
   * Parent should remove this card from the list.
   */
  onDeleted?: (sharedId: string) => void;
}

/* -------------------------------------------------------------------------- */
/* Helper Components                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Displays a player name with optional chess title.
 */
function PlayerName({
  username,
  chessTitle,
}: {
  username: string;
  chessTitle?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 truncate">
      {chessTitle && <ChessTitleBadge chessTitle={chessTitle} />}
      <span className="truncate">{username}</span>
    </span>
  );
}

/**
 * Returns a formatted date string for display.
 * Handles Date objects and converts other types safely.
 */
function formatDate(date: Date): string {
  // Ensure we have a valid Date object
  const dateObj = date instanceof Date ? date : new Date(date);

  // Check if the date is valid
  if (isNaN(dateObj.getTime())) {
    return "Invalid date";
  }

  return dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Returns the label for the content type.
 */
function getContentTypeLabel(type: SharedGameSummary["type"]): string {
  switch (type) {
    case "match":
      return "Match";
    case "partnerGames":
      return "Partner Games";
    case "game":
    default:
      return "Game";
  }
}

/**
 * Returns CSS classes for the content type badge.
 */
function getContentTypeBadgeClasses(type: SharedGameSummary["type"]): string {
  switch (type) {
    case "match":
      return "bg-amber-600/20 text-amber-400 border-amber-600/30";
    case "partnerGames":
      return "bg-emerald-600/20 text-emerald-400 border-emerald-600/30";
    case "game":
    default:
      return "bg-mariner-600/20 text-mariner-400 border-mariner-600/30";
  }
}

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Card component for displaying a shared game in the shared games grid.
 * Shows game metadata, players, result, and allows deletion if owned by the current user.
 */
export default function SharedGameCard({
  game,
  currentUserId,
  onDeleted,
}: SharedGameCardProps) {
  const router = useRouter();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwner = currentUserId === game.sharerUserId;

  const handleCardClick = useCallback(() => {
    // Navigate to viewer with the shared game ID
    router.push(`/?sharedId=${game.id}`);
  }, [router, game.id]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setIsDeleteModalOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!currentUserId) return;

    setIsDeleting(true);
    try {
      const result = await deleteSharedGame(currentUserId, game.id);
      if (result.success) {
        toast.success("Shared game deleted");
        setIsDeleteModalOpen(false);
        onDeleted?.(game.id);
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      console.error("[SharedGameCard] Delete failed:", err);
      const message = err instanceof Error ? err.message : "Failed to delete";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  }, [currentUserId, game.id, onDeleted]);

  const handleCancelDelete = useCallback(() => {
    if (isDeleting) return;
    setIsDeleteModalOpen(false);
  }, [isDeleting]);

  const { team1, team2, result, gameCount } = game.metadata;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick();
          }
        }}
        className={[
          "relative group cursor-pointer",
          "rounded-xl border border-mariner-700/50 bg-gray-800/60",
          "p-4 transition-all duration-200",
          "hover:border-mariner-500/70 hover:bg-gray-800/80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mariner-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900",
        ].join(" ")}
        aria-label={`View ${getContentTypeLabel(game.type)} by ${game.sharerUsername}`}
      >
        {/* Delete button (only visible to owner) */}
        {isOwner && (
          <button
            type="button"
            onClick={handleDeleteClick}
            className={[
              "absolute top-2 right-2 z-10",
              "h-6 w-6 rounded-full",
              "flex items-center justify-center",
              "bg-red-600/80 text-white",
              "opacity-0 group-hover:opacity-100 transition-opacity",
              "hover:bg-red-500 focus-visible:opacity-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60",
            ].join(" ")}
            aria-label="Delete shared game"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}

        {/* Content type badge */}
        <div className="mb-3 flex items-center justify-between">
          <span
            className={[
              "rounded-md border px-2 py-0.5 text-xs font-medium",
              getContentTypeBadgeClasses(game.type),
            ].join(" ")}
          >
            {getContentTypeLabel(game.type)}
          </span>
          {gameCount > 1 && (
            <span className="text-xs text-gray-400">
              {gameCount} games
            </span>
          )}
        </div>

        {/* Players and result */}
        <div className="mb-3 flex items-center justify-between gap-2 text-sm">
          {/* Team 1 */}
          <div className="flex-1 min-w-0 text-gray-200">
            <div className="truncate">
              <PlayerName
                username={team1.player1.username}
                chessTitle={team1.player1.chessTitle}
              />
            </div>
            <div className="truncate">
              <PlayerName
                username={team1.player2.username}
                chessTitle={team1.player2.chessTitle}
              />
            </div>
          </div>

          {/* Result */}
          <div className="shrink-0 text-center px-2">
            <span className="text-lg font-bold text-gray-100">{result}</span>
          </div>

          {/* Team 2 */}
          <div className="flex-1 min-w-0 text-right text-gray-200">
            <div className="truncate">
              <PlayerName
                username={team2.player1.username}
                chessTitle={team2.player1.chessTitle}
              />
            </div>
            <div className="truncate">
              <PlayerName
                username={team2.player2.username}
                chessTitle={team2.player2.chessTitle}
              />
            </div>
          </div>
        </div>

        {/* Sharer info */}
        <div className="text-sm text-gray-400">
          Shared by: <span className="text-gray-200">{game.sharerUsername}</span>
        </div>

        {/* Description (if present) - non-clickable to allow URL clicks */}
        {game.description && (
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="mt-2 cursor-text"
          >
            <p className="text-sm text-gray-400 italic line-clamp-2">
              {game.description}
            </p>
          </div>
        )}

        {/* Date */}
        <div className="mt-2 text-xs text-gray-500">
          {formatDate(game.gameDate)}
        </div>
      </div>

      {/* Delete confirmation modal */}
      <DeleteConfirmationModal
        open={isDeleteModalOpen}
        title="Delete shared game?"
        message="This will permanently remove this shared game from the platform. This action cannot be undone."
        isDeleting={isDeleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={handleCancelDelete}
      />
    </>
  );
}
