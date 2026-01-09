"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { getFirestoreDb } from "./firebaseClient";
import type { ChessGame } from "../actions";
import type { MatchGame } from "../types/match";
import type {
  SharedGameDocument,
  SharedGame,
  SharedGameData,
  SharedGameDataLegacy,
  SharedGameMetadata,
  SharedGameSummary,
  SharedGameSubDocument,
  SingleGameData,
  GetSharedGamesOptions,
  SharedGamesPage,
  ShareResult,
  DeleteSharedGameResult,
  MatchGameData,
} from "../types/sharedGame";
import {
  toSharedGameSummary,
  toMatchGameData as convertToMatchGameData,
  SHARED_GAMES_DEFAULT_PAGE_SIZE as DEFAULT_PAGE_SIZE,
  SHARED_GAMES_SCHEMA_VERSION,
  SHARED_GAMES_SUBCOLLECTION,
} from "../types/sharedGame";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const SHARED_GAMES_COLLECTION = "sharedGames";
const USERS_COLLECTION = "users";
const USER_SHARED_GAMES_SUBCOLLECTION = "sharedGames";

/* -------------------------------------------------------------------------- */
/* Helper Functions                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Extracts the game date from ChessGame data.
 * Uses the end_time if available, otherwise falls back to parsing the Date header.
 *
 * @param game - The ChessGame data
 * @returns Timestamp for the game date
 */
function extractGameDate(game: ChessGame): Timestamp {
  // Try to use endTime from the game data (Unix timestamp in seconds)
  if (game.game.endTime) {
    return Timestamp.fromMillis(game.game.endTime * 1000);
  }

  // Fallback: parse the Date header (format: "YYYY.MM.DD")
  const dateStr = game.game.pgnHeaders.Date;
  if (dateStr) {
    const [year, month, day] = dateStr.split(".").map(Number);
    if (year && month && day) {
      return Timestamp.fromDate(new Date(year, month - 1, day));
    }
  }

  // Last resort: use current time
  return Timestamp.now();
}

/**
 * Creates a SharedGamePlayer object, omitting chessTitle if undefined.
 * Firestore does not accept undefined values, so we must exclude the field entirely.
 *
 * @param username - Player's username
 * @param chessTitle - Optional chess title (may be undefined)
 * @returns SharedGamePlayer object with only defined fields
 */
function createPlayerForMetadata(
  username: string,
  chessTitle: string | undefined,
): { username: string; chessTitle?: string } {
  if (chessTitle) {
    return { username, chessTitle };
  }
  return { username };
}

/**
 * Builds metadata for a single game.
 *
 * @param original - Board A game data
 * @param partner - Board B game data (optional)
 * @returns SharedGameMetadata object
 */
function buildSingleGameMetadata(
  original: ChessGame,
  partner: ChessGame | null,
): SharedGameMetadata {
  const aWhite = original.game.pgnHeaders.White;
  const aBlack = original.game.pgnHeaders.Black;
  const bWhite = partner?.game.pgnHeaders.White ?? "Unknown";
  const bBlack = partner?.game.pgnHeaders.Black ?? "Unknown";

  // Get chess titles from the correct player positions
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

  // Determine result based on colorOfWinner
  // Team 1: aWhite + bBlack, Team 2: aBlack + bWhite
  const winner = original.game.colorOfWinner;
  let result: string;
  if (!winner) {
    result = "½ - ½";
  } else if (winner === "white") {
    // Board A white won, which means Team 1 won
    result = "1 - 0";
  } else {
    // Board A black won, which means Team 2 won
    result = "0 - 1";
  }

  return {
    gameCount: 1,
    result,
    team1: {
      player1: createPlayerForMetadata(aWhite, aWhiteTitle),
      player2: createPlayerForMetadata(bBlack, bBlackTitle),
    },
    team2: {
      player1: createPlayerForMetadata(aBlack, aBlackTitle),
      player2: createPlayerForMetadata(bWhite, bWhiteTitle),
    },
  };
}

/**
 * Builds metadata for a match (multiple games).
 *
 * @param matchGames - Array of match games
 * @returns SharedGameMetadata object
 */
function buildMatchMetadata(matchGames: MatchGame[]): SharedGameMetadata {
  if (matchGames.length === 0) {
    throw new Error("Cannot build metadata for empty match");
  }

  // Use first game to get player info
  const firstGame = matchGames[0]!;
  const aWhite = firstGame.original.game.pgnHeaders.White;
  const aBlack = firstGame.original.game.pgnHeaders.Black;
  const bWhite = firstGame.partner.game.pgnHeaders.White;
  const bBlack = firstGame.partner.game.pgnHeaders.Black;

  // Get chess titles from the correct player positions
  const aWhiteTitle = firstGame.original.players.top.color === "white"
    ? firstGame.original.players.top.chessTitle
    : firstGame.original.players.bottom.chessTitle;
  const aBlackTitle = firstGame.original.players.top.color === "black"
    ? firstGame.original.players.top.chessTitle
    : firstGame.original.players.bottom.chessTitle;
  const bWhiteTitle = firstGame.partner.players.top.color === "white"
    ? firstGame.partner.players.top.chessTitle
    : firstGame.partner.players.bottom.chessTitle;
  const bBlackTitle = firstGame.partner.players.top.color === "black"
    ? firstGame.partner.players.top.chessTitle
    : firstGame.partner.players.bottom.chessTitle;

  // Count wins for each team
  // Team 1: aWhite + bBlack, Team 2: aBlack + bWhite
  let team1Wins = 0;
  let team2Wins = 0;

  for (const game of matchGames) {
    const winner = game.original.game.colorOfWinner;
    if (winner === "white") {
      team1Wins++;
    } else if (winner === "black") {
      team2Wins++;
    }
    // Draws don't count for either team
  }

  return {
    gameCount: matchGames.length,
    result: `${team1Wins} - ${team2Wins}`,
    team1: {
      player1: createPlayerForMetadata(aWhite, aWhiteTitle),
      player2: createPlayerForMetadata(bBlack, bBlackTitle),
    },
    team2: {
      player1: createPlayerForMetadata(aBlack, aBlackTitle),
      player2: createPlayerForMetadata(bWhite, bWhiteTitle),
    },
  };
}

/**
 * Fetches game data from the subcollection.
 * Handles both schema v1 (inline gameData) and v2 (subcollection).
 *
 * @param sharedId - The shared game ID
 * @param docData - The main document data
 * @returns SharedGameData object
 */
async function fetchGameData(
  sharedId: string,
  docData: SharedGameDocument,
): Promise<SharedGameData> {
  // Schema v1: game data is in the main document
  if (docData.schemaVersion === 1 || !docData.schemaVersion) {
    if (!docData.gameData) {
      throw new Error("Legacy document missing gameData");
    }
    // Convert legacy format to current format
    const legacyData = docData.gameData as SharedGameDataLegacy;
    return legacyData;
  }

  // Schema v2: game data is in subcollection
  const db = getFirestoreDb();
  const gamesRef = collection(db, SHARED_GAMES_COLLECTION, sharedId, SHARED_GAMES_SUBCOLLECTION);
  const q = query(gamesRef, orderBy("index", "asc"));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    throw new Error("No game data found in subcollection");
  }

  const subDocs = snapshot.docs.map((d) => d.data() as SharedGameSubDocument);

  // Single game
  if (docData.type === "game") {
    const singleDoc = subDocs[0];
    if (!singleDoc || singleDoc.type !== "single") {
      throw new Error("Invalid single game data");
    }
    return {
      type: "game",
      game: singleDoc.data,
    };
  }

  // Match or partner games
  const matchGames: MatchGameData[] = subDocs
    .filter((d): d is SharedGameSubDocument & { type: "match" } => d.type === "match")
    .sort((a, b) => a.index - b.index)
    .map((d) => d.data);

  return {
    type: docData.type,
    games: matchGames,
  };
}

/* -------------------------------------------------------------------------- */
/* Firestore Operations                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Shares a single bughouse game.
 * Uses schema v2: metadata in main document, game data in subcollection.
 *
 * @param userId - Firebase Auth UID of the sharer
 * @param username - Username of the sharer
 * @param gameData - The game data to share (original + partner boards)
 * @param description - Optional description (max 100 characters)
 * @returns ShareResult indicating success or failure
 */
export async function shareGame(
  userId: string,
  username: string,
  gameData: SingleGameData,
  description: string = "",
): Promise<ShareResult> {
  try {
    const db = getFirestoreDb();
    const sharedId = uuidv4();

    const metadata = buildSingleGameMetadata(gameData.original, gameData.partner);
    const gameDate = extractGameDate(gameData.original);

    // Main document (without game data)
    const sharedGameDoc = {
      id: sharedId,
      schemaVersion: SHARED_GAMES_SCHEMA_VERSION,
      type: "game" as const,
      sharerUserId: userId,
      sharerUsername: username,
      description: description.slice(0, 100),
      sharedAt: serverTimestamp(),
      gameDate,
      metadata,
    };

    // User reference document
    const userSharedGameRef = {
      sharedId,
      sharedAt: serverTimestamp(),
    };

    // Game data subcollection document
    const gameSubDoc: SharedGameSubDocument = {
      index: 0,
      type: "single",
      data: gameData,
    };

    // Use a batch write to ensure atomicity
    const batch = writeBatch(db);

    // Main document
    const sharedGameDocRef = doc(db, SHARED_GAMES_COLLECTION, sharedId);
    batch.set(sharedGameDocRef, sharedGameDoc);

    // User reference
    const userSharedGameDocRef = doc(
      db,
      USERS_COLLECTION,
      userId,
      USER_SHARED_GAMES_SUBCOLLECTION,
      sharedId,
    );
    batch.set(userSharedGameDocRef, userSharedGameRef);

    // Game data in subcollection
    const gameDocRef = doc(
      db,
      SHARED_GAMES_COLLECTION,
      sharedId,
      SHARED_GAMES_SUBCOLLECTION,
      "0",
    );
    batch.set(gameDocRef, gameSubDoc);

    await batch.commit();

    return { success: true, sharedId };
  } catch (err) {
    console.error("[sharedGamesService] shareGame failed:", err);
    const message = err instanceof Error ? err.message : "Failed to share game";
    return { success: false, error: message };
  }
}

/**
 * Shares a match (multiple games with the same players).
 * Uses schema v2: metadata in main document, each game in subcollection.
 *
 * @param userId - Firebase Auth UID of the sharer
 * @param username - Username of the sharer
 * @param matchGames - Array of match games to share
 * @param type - Type of shared content ("match" or "partnerGames")
 * @param description - Optional description (max 100 characters)
 * @returns ShareResult indicating success or failure
 */
export async function shareMatch(
  userId: string,
  username: string,
  matchGames: MatchGame[],
  type: "match" | "partnerGames" = "match",
  description: string = "",
): Promise<ShareResult> {
  try {
    if (matchGames.length === 0) {
      return { success: false, error: "No games to share" };
    }

    const db = getFirestoreDb();
    const sharedId = uuidv4();

    const metadata = buildMatchMetadata(matchGames);
    // Use the first game's date as the match date
    const gameDate = extractGameDate(matchGames[0]!.original);

    // Main document (without game data)
    const sharedGameDoc = {
      id: sharedId,
      schemaVersion: SHARED_GAMES_SCHEMA_VERSION,
      type,
      sharerUserId: userId,
      sharerUsername: username,
      description: description.slice(0, 100),
      sharedAt: serverTimestamp(),
      gameDate,
      metadata,
    };

    // User reference document
    const userSharedGameRef = {
      sharedId,
      sharedAt: serverTimestamp(),
    };

    // Convert match games to storage format
    const matchGameDataArray = convertToMatchGameData(matchGames);

    // Use a batch write to ensure atomicity
    // Note: Firestore batches are limited to 500 operations
    // For very large matches, we may need multiple batches
    const batch = writeBatch(db);

    // Main document
    const sharedGameDocRef = doc(db, SHARED_GAMES_COLLECTION, sharedId);
    batch.set(sharedGameDocRef, sharedGameDoc);

    // User reference
    const userSharedGameDocRef = doc(
      db,
      USERS_COLLECTION,
      userId,
      USER_SHARED_GAMES_SUBCOLLECTION,
      sharedId,
    );
    batch.set(userSharedGameDocRef, userSharedGameRef);

    // Each game in subcollection
    for (let i = 0; i < matchGameDataArray.length; i++) {
      const gameSubDoc: SharedGameSubDocument = {
        index: i,
        type: "match",
        data: matchGameDataArray[i]!,
      };

      const gameDocRef = doc(
        db,
        SHARED_GAMES_COLLECTION,
        sharedId,
        SHARED_GAMES_SUBCOLLECTION,
        String(i),
      );
      batch.set(gameDocRef, gameSubDoc);
    }

    await batch.commit();

    return { success: true, sharedId };
  } catch (err) {
    console.error("[sharedGamesService] shareMatch failed:", err);
    const message = err instanceof Error ? err.message : "Failed to share match";
    return { success: false, error: message };
  }
}

/**
 * Fetches a paginated list of shared games (summaries only).
 * Games are sorted by sharedAt timestamp (newest first).
 * Does not fetch game data - use getSharedGame for full data.
 *
 * @param options - Pagination options
 * @returns SharedGamesPage with game summaries and pagination info
 */
export async function getSharedGames(
  options: GetSharedGamesOptions = {},
): Promise<SharedGamesPage> {
  const { pageSize = DEFAULT_PAGE_SIZE, startAfter: startAfterDate } = options;

  try {
    const db = getFirestoreDb();
    const sharedGamesRef = collection(db, SHARED_GAMES_COLLECTION);

    // Build query with pagination
    let q = query(
      sharedGamesRef,
      orderBy("sharedAt", "desc"),
      limit(pageSize + 1), // Fetch one extra to check if there are more
    );

    if (startAfterDate) {
      const startAfterTimestamp = Timestamp.fromDate(startAfterDate);
      q = query(
        sharedGamesRef,
        orderBy("sharedAt", "desc"),
        startAfter(startAfterTimestamp),
        limit(pageSize + 1),
      );
    }

    const snapshot = await getDocs(q);
    const docs = snapshot.docs;

    // Check if there are more pages
    const hasMore = docs.length > pageSize;
    const gameDocs = hasMore ? docs.slice(0, pageSize) : docs;

    const games: SharedGameSummary[] = gameDocs.map((docSnap) => {
      const data = docSnap.data() as SharedGameDocument;
      return toSharedGameSummary(data);
    });

    // Get the cursor for the next page
    const lastGame = games[games.length - 1];
    const nextCursor = hasMore && lastGame ? lastGame.sharedAt : null;

    return {
      games,
      hasMore,
      nextCursor,
    };
  } catch (err) {
    console.error("[sharedGamesService] getSharedGames failed:", err);
    throw new Error("Failed to fetch shared games");
  }
}

/**
 * Fetches a single shared game by ID, including full game data.
 * Handles both schema v1 (legacy) and v2 (current).
 *
 * @param sharedId - The shared game UUID
 * @returns SharedGame if found, null otherwise
 */
export async function getSharedGame(sharedId: string): Promise<SharedGame | null> {
  try {
    const db = getFirestoreDb();
    const docRef = doc(db, SHARED_GAMES_COLLECTION, sharedId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data() as SharedGameDocument;

    // Fetch game data (handles both schema versions)
    const gameData = await fetchGameData(sharedId, data);

    return {
      id: data.id,
      type: data.type,
      sharerUserId: data.sharerUserId,
      sharerUsername: data.sharerUsername,
      description: data.description,
      sharedAt: data.sharedAt.toDate(),
      gameDate: data.gameDate.toDate(),
      gameData,
      metadata: data.metadata,
    };
  } catch (err) {
    console.error("[sharedGamesService] getSharedGame failed:", err);
    throw new Error("Failed to fetch shared game");
  }
}

/**
 * Deletes a shared game, including all game data in subcollection.
 * Only the original sharer can delete their shared game.
 *
 * @param userId - Firebase Auth UID of the user attempting to delete
 * @param sharedId - The shared game UUID to delete
 * @returns DeleteSharedGameResult indicating success or failure
 */
export async function deleteSharedGame(
  userId: string,
  sharedId: string,
): Promise<DeleteSharedGameResult> {
  try {
    const db = getFirestoreDb();

    // First verify the user is the sharer
    const sharedGameRef = doc(db, SHARED_GAMES_COLLECTION, sharedId);
    const sharedGameSnap = await getDoc(sharedGameRef);

    if (!sharedGameSnap.exists()) {
      return { success: false, error: "Shared game not found" };
    }

    const sharedGameData = sharedGameSnap.data() as SharedGameDocument;
    if (sharedGameData.sharerUserId !== userId) {
      return { success: false, error: "You can only delete your own shared games" };
    }

    // Fetch all documents in the games subcollection
    const gamesRef = collection(db, SHARED_GAMES_COLLECTION, sharedId, SHARED_GAMES_SUBCOLLECTION);
    const gamesSnapshot = await getDocs(gamesRef);

    // Use a batch write to delete everything atomically
    const batch = writeBatch(db);

    // Delete all game documents in subcollection
    for (const gameDoc of gamesSnapshot.docs) {
      batch.delete(gameDoc.ref);
    }

    // Delete the main document
    batch.delete(sharedGameRef);

    // Delete the user reference
    const userSharedGameRef = doc(
      db,
      USERS_COLLECTION,
      userId,
      USER_SHARED_GAMES_SUBCOLLECTION,
      sharedId,
    );
    batch.delete(userSharedGameRef);

    await batch.commit();

    return { success: true };
  } catch (err) {
    console.error("[sharedGamesService] deleteSharedGame failed:", err);
    const message = err instanceof Error ? err.message : "Failed to delete shared game";
    return { success: false, error: message };
  }
}

/**
 * Fetches shared games for a specific user (summaries only).
 *
 * @param userId - Firebase Auth UID of the user
 * @returns Array of SharedGameSummary objects
 */
export async function getUserSharedGames(userId: string): Promise<SharedGameSummary[]> {
  try {
    const db = getFirestoreDb();

    // Get the user's shared game references
    const userSharedGamesRef = collection(
      db,
      USERS_COLLECTION,
      userId,
      USER_SHARED_GAMES_SUBCOLLECTION,
    );
    const q = query(userSharedGamesRef, orderBy("sharedAt", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return [];
    }

    // Fetch the shared game summaries (not full data)
    const sharedIds = snapshot.docs.map((d) => d.id);
    const games: SharedGameSummary[] = [];

    for (const sharedId of sharedIds) {
      const docRef = doc(db, SHARED_GAMES_COLLECTION, sharedId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as SharedGameDocument;
        games.push(toSharedGameSummary(data));
      }
    }

    return games;
  } catch (err) {
    console.error("[sharedGamesService] getUserSharedGames failed:", err);
    throw new Error("Failed to fetch user's shared games");
  }
}
