/**
 * Backfill Script: Shared Game Content Hashes
 *
 * Computes deterministic hashes for existing shared games and stores them in
 * users/{userId}/sharedGames/{sharedId}. This prevents future duplicate shares
 * while tolerating any historical duplicates.
 *
 * Prerequisites:
 * Environment variables in .env.local (loaded automatically):
 *   - FIREBASE_PROJECT_ID
 *   - FIREBASE_CLIENT_EMAIL
 *   - FIREBASE_PRIVATE_KEY
 *
 * Usage:
 *   # Dry run (default)
 *   npm run migration:shared-game-hashes
 *
 *   # Apply changes
 *   DRY_RUN=false npm run migration:shared-game-hashes
 */

// Load environment variables from .env.local before anything else
import { config } from "dotenv";
config({ path: ".env.local" });

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { MatchGameData, SharedContentType, SingleGameData } from "../app/types/sharedGame";
import {
  computeShareContentHash,
  createShareHashInputFromMatchData,
  createShareHashInputFromSingleGame,
} from "../app/utils/sharedGameHash";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface SharedGameDocumentSnapshot {
  id: string;
  type: SharedContentType;
  sharerUserId: string;
  metadata?: {
    team1?: {
      player1?: { username?: string };
      player2?: { username?: string };
    };
  };
}

type SharedGameSubDocument =
  | {
      index: number;
      type: "single";
      data: SingleGameData;
    }
  | {
      index: number;
      type: "match";
      data: MatchGameData;
    };

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const SHARED_GAMES_COLLECTION = "sharedGames";
const USERS_COLLECTION = "users";
const USER_SHARED_GAMES_SUBCOLLECTION = "sharedGames";
const GAMES_SUBCOLLECTION = "games";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function log(message: string, ...args: unknown[]): void {
  console.log(`[${new Date().toISOString()}] ${message}`, ...args);
}

function logError(message: string, ...args: unknown[]): void {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`, ...args);
}

function deriveSelectedPairUsernames(
  metadata: SharedGameDocumentSnapshot["metadata"],
): [string, string] | null {
  const player1 = metadata?.team1?.player1?.username;
  const player2 = metadata?.team1?.player2?.username;
  if (!player1 || !player2) {
    return null;
  }
  const normalized = [player1.toLowerCase(), player2.toLowerCase()].sort();
  return [normalized[0]!, normalized[1]!];
}

/* -------------------------------------------------------------------------- */
/* Migration Logic                                                            */
/* -------------------------------------------------------------------------- */

interface MigrationStats {
  total: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

async function fetchGameSubcollection(
  docRef: FirebaseFirestore.DocumentReference,
): Promise<SharedGameSubDocument[]> {
  const snapshot = await docRef.collection(GAMES_SUBCOLLECTION).orderBy("index", "asc").get();
  return snapshot.docs.map((docSnap) => docSnap.data() as SharedGameSubDocument);
}

async function runMigration(dryRun: boolean): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Initialize Firebase Admin
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId) {
      throw new Error("FIREBASE_PROJECT_ID environment variable is required");
    }
    if (!clientEmail) {
      throw new Error("FIREBASE_CLIENT_EMAIL environment variable is required");
    }
    if (!privateKey) {
      throw new Error("FIREBASE_PRIVATE_KEY environment variable is required");
    }

    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
      projectId,
    });
  }

  const db = getFirestore();

  log("Starting shared game hash backfill...");
  log(`Dry run: ${dryRun}`);
  log("");

  const sharedGamesSnapshot = await db.collection(SHARED_GAMES_COLLECTION).get();
  stats.total = sharedGamesSnapshot.size;
  log(`Found ${stats.total} shared game document(s)`);

  for (const docSnap of sharedGamesSnapshot.docs) {
    const docData = docSnap.data() as SharedGameDocumentSnapshot;
    const docRef = docSnap.ref;
    const sharedId = docData.id ?? docSnap.id;

    try {
      if (!docData.sharerUserId) {
        throw new Error("Missing sharerUserId");
      }

      const subDocs = await fetchGameSubcollection(docRef);
      if (subDocs.length === 0) {
        throw new Error("Missing games subcollection");
      }

      let contentHash: string;
      if (docData.type === "game") {
        const singleDoc = subDocs.find((doc) => doc.type === "single");
        if (!singleDoc || singleDoc.type !== "single") {
          throw new Error("Missing single game data");
        }
        contentHash = computeShareContentHash(
          createShareHashInputFromSingleGame({
            userId: docData.sharerUserId,
            gameData: singleDoc.data,
          }),
        );
      } else {
        const matchDocs = subDocs
          .filter((doc): doc is SharedGameSubDocument & { type: "match" } => doc.type === "match")
          .sort((a, b) => a.index - b.index);

        if (matchDocs.length === 0) {
          throw new Error("Missing match game data");
        }

        const selectedPairUsernames =
          docData.type === "partnerGames" ? deriveSelectedPairUsernames(docData.metadata) : null;

        if (docData.type === "partnerGames" && !selectedPairUsernames) {
          throw new Error("Missing partner pair metadata");
        }

        contentHash = computeShareContentHash(
          createShareHashInputFromMatchData({
            userId: docData.sharerUserId,
            contentType: docData.type,
            matchGames: matchDocs.map((doc) => doc.data),
            selectedPairUsernames,
          }),
        );
      }

      if (dryRun) {
        log(`  - [DRY RUN] Would update ${docData.sharerUserId}/${sharedId}`);
        stats.updated++;
        continue;
      }

      const userSharedGameRef = db
        .collection(USERS_COLLECTION)
        .doc(docData.sharerUserId)
        .collection(USER_SHARED_GAMES_SUBCOLLECTION)
        .doc(sharedId);

      await userSharedGameRef.set({ contentHash }, { merge: true });
      stats.updated++;
    } catch (err) {
      stats.failed++;
      const message = err instanceof Error ? err.message : String(err);
      stats.errors.push({ id: sharedId, error: message });
      logError(`Failed to backfill ${sharedId}: ${message}`);
    }
  }

  return stats;
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  const dryRun = process.env.DRY_RUN !== "false";

  console.log("=".repeat(80));
  console.log("Shared Game Hash Backfill");
  console.log("=".repeat(80));
  console.log("");

  if (dryRun) {
    console.log("⚠️  DRY RUN MODE - No changes will be made to the database");
    console.log("   Set DRY_RUN=false to perform the actual migration");
    console.log("");
  }

  try {
    const stats = await runMigration(dryRun);

    console.log("");
    console.log("=".repeat(80));
    console.log("Backfill Summary");
    console.log("=".repeat(80));
    console.log(`Total documents:      ${stats.total}`);
    console.log(`Updated:              ${stats.updated}`);
    console.log(`Failed:               ${stats.failed}`);
    console.log("");

    if (stats.errors.length > 0) {
      console.log("Errors:");
      for (const error of stats.errors) {
        console.log(`  - ${error.id}: ${error.error}`);
      }
      console.log("");
    }

    if (dryRun) {
      console.log("✅ Dry run completed successfully");
      console.log("   Run with DRY_RUN=false to apply changes");
    } else {
      console.log("✅ Backfill completed");
    }

    if (stats.failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("");
    console.error("❌ Backfill failed with error:");
    console.error(err);
    process.exit(1);
  }
}

main();
