/**
 * @module sharedGameHash
 *
 * Deterministic content hashing for share deduplication.
 *
 * Hashes are scoped per user (`userId`) so two users may share identical games independently.
 * Normalization (sorted game pairs, lowercase partner usernames) prevents order/format drift
 * from creating false negatives.
 */
import { sha256 } from "js-sha256";
import type { ChessGame } from "@/app/actions";
import type { MatchGame, PartnerPair } from "@/app/types/match";
import type { MatchGameData, SharedContentType, SingleGameData } from "@/app/types/sharedGame";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Normalized pair of game IDs (Board A + Board B).
 */
export interface ShareGamePair {
  gameId: string;
  partnerGameId: string | null;
}

/**
 * Input for computing a deterministic share hash.
 *
 * The hash is intended for deduplication only (not security).
 */
export interface ShareContentHashInput {
  /**
   * Firebase Auth UID of the sharer.
   */
  userId: string;
  /**
   * The type of content being shared.
   */
  contentType: SharedContentType;
  /**
   * Game pairs included in the share (order will be normalized).
   */
  gamePairs: ShareGamePair[];
  /**
   * Partner pair usernames (required for partner series).
   * Should be lowercase and sorted when possible.
   */
  selectedPairUsernames?: [string, string] | null;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

/** Bump when canonical hash string format changes (invalidates prior dedup keys). */
const HASH_VERSION = "v2";

/** Prefix segment in the canonical preimage — aids debugging hash collisions. */
const HASH_PREFIX = "bh-share";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Returns Board A game id or throws — hashes require stable Chess.com identifiers. */
function getRequiredGameId(game: ChessGame): string {
  const id = game?.game?.id;
  if (id === null || id === undefined) {
    throw new Error("Missing game ID for share hash");
  }
  return String(id);
}

/** Prefers explicit partner id; falls back to embedded partner game payload. */
function resolvePartnerGameId(partnerId: string | null, partner: ChessGame | null): string | null {
  if (partnerId) {
    return partnerId;
  }
  const fallback = partner?.game?.id;
  return fallback === null || fallback === undefined ? null : String(fallback);
}

/** Canonical string for one board pair; partner id sorts with game id for stability. */
function normalizePair(pair: ShareGamePair): string {
  const gameId = pair.gameId;
  const partnerId = pair.partnerGameId ?? "none";
  const [first, second] = [gameId, partnerId].sort();
  return `${first}|${second}`;
}

/** Lowercases and sorts partner usernames; required only for `partnerGames` shares. */
function normalizeSelectedPair(
  contentType: SharedContentType,
  selectedPairUsernames?: [string, string] | null,
): string {
  if (contentType !== "partnerGames") {
    return "none";
  }
  if (!selectedPairUsernames || selectedPairUsernames.length !== 2) {
    throw new Error("Missing partner pair for partner series share hash");
  }
  const [first, second] = selectedPairUsernames.map((name) => name.toLowerCase()).sort();
  return `${first}|${second}`;
}

/**
 * Computes a SHA-256 hex digest for the provided input.
 */
function sha256Hex(input: string): string {
  return sha256(input);
}

/** Builds the pipe-delimited preimage that is hashed — changes require HASH_VERSION bump. */
function buildCanonicalShareString(input: ShareContentHashInput): string {
  if (!input.userId) {
    throw new Error("Missing user ID for share hash");
  }
  if (input.gamePairs.length === 0) {
    throw new Error("Missing game pairs for share hash");
  }

  const normalizedPairs = input.gamePairs.map(normalizePair).sort();
  const selectedPair = normalizeSelectedPair(input.contentType, input.selectedPairUsernames);

  return [
    `${HASH_PREFIX}:${HASH_VERSION}`,
    `user:${input.userId}`,
    `type:${input.contentType}`,
    `pair:${selectedPair}`,
    `games:${normalizedPairs.join(",")}`,
  ].join("|");
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Computes a deterministic hash for a share request.
 *
 * Uses SHA-256 for stable, collision-resistant deduplication.
 *
 * @example
 * ```ts
 * const input = createShareHashInputFromSingleGame({ userId, gameData });
 * const contentHash = computeShareContentHash(input);
 * ```
 */
export function computeShareContentHash(input: ShareContentHashInput): string {
  const canonical = buildCanonicalShareString(input);
  return `bh2_${sha256Hex(canonical)}`;
}

/**
 * Builds a share hash input from a single game payload.
 */
export function createShareHashInputFromSingleGame(params: {
  userId: string;
  gameData: SingleGameData;
}): ShareContentHashInput {
  const { userId, gameData } = params;
  return {
    userId,
    contentType: "game",
    gamePairs: [
      {
        gameId: getRequiredGameId(gameData.original),
        partnerGameId: resolvePartnerGameId(gameData.partnerId, gameData.partner),
      },
    ],
  };
}

/**
 * Builds a share hash input from match discovery games.
 */
export function createShareHashInputFromMatchGames(params: {
  userId: string;
  contentType: "match" | "partnerGames";
  matchGames: MatchGame[];
  selectedPair?: PartnerPair | null;
}): ShareContentHashInput {
  const { userId, contentType, matchGames, selectedPair } = params;
  if (matchGames.length === 0) {
    throw new Error("Cannot build share hash from empty match");
  }

  return {
    userId,
    contentType,
    gamePairs: matchGames.map((game) => ({
      gameId: game.gameId,
      partnerGameId: game.partnerGameId,
    })),
    selectedPairUsernames: contentType === "partnerGames" ? selectedPair?.usernames ?? null : null,
  };
}

/**
 * Builds a share hash input from stored match game data.
 */
export function createShareHashInputFromMatchData(params: {
  userId: string;
  contentType: "match" | "partnerGames";
  matchGames: MatchGameData[];
  selectedPairUsernames?: [string, string] | null;
}): ShareContentHashInput {
  const { userId, contentType, matchGames, selectedPairUsernames } = params;
  if (matchGames.length === 0) {
    throw new Error("Cannot build share hash from empty match data");
  }

  return {
    userId,
    contentType,
    gamePairs: matchGames.map((game) => ({
      gameId: game.gameId,
      partnerGameId: game.partnerGameId,
    })),
    selectedPairUsernames: contentType === "partnerGames" ? selectedPairUsernames ?? null : null,
  };
}
