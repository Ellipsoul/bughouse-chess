/**
 * Migration Script: Shared Games Schema v1 → v2
 *
 * This script migrates shared games from schema v1 (all game data in main document)
 * to schema v2 (game data in subcollection to avoid 1MB document limit).
 *
 * Prerequisites:
 * Environment variables in .env.local (loaded automatically):
 *   - FIREBASE_PROJECT_ID: Your Firebase project ID
 *   - FIREBASE_CLIENT_EMAIL: Service account email (from Firebase Console)
 *   - FIREBASE_PRIVATE_KEY: Service account private key (from Firebase Console)
 *
 * Usage:
 *   # Dry run (preview only) - default
 *   npm run migration:shared-games-v2
 *
 *   # Actual migration
 *   DRY_RUN=false npm run migration:shared-games-v2
 *
 * What this script does:
 * 1. Fetches all documents from the sharedGames collection
 * 2. For each document with schemaVersion != 2 (or missing schemaVersion):
 *    a. Extracts gameData from the document
 *    b. Creates documents in the games subcollection
 *    c. Updates the main document to set schemaVersion=2 and remove gameData
 * 3. Reports progress and any errors
 *
 * Each document migration is atomic (uses batch writes).
 *
 * @see app/types/sharedGame.ts for schema definitions
 */

// Load environment variables from .env.local before anything else
import { config } from "dotenv";
config({ path: ".env.local" });

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

/* -------------------------------------------------------------------------- */
/* Types (copied from app/types/sharedGame.ts to avoid client imports)        */
/* -------------------------------------------------------------------------- */

interface SingleGameData {
  original: unknown;
  partner: unknown | null;
  partnerId: string | null;
}

interface MatchGameData {
  gameId: string;
  partnerGameId: string;
  original: unknown;
  partner: unknown;
  endTime: number;
}

type SharedGameDataLegacy =
  | { type: "game"; game: SingleGameData }
  | { type: "match" | "partnerGames"; games: MatchGameData[] };

interface SharedGameDocumentLegacy {
  id: string;
  schemaVersion?: number;
  type: "game" | "match" | "partnerGames";
  sharerUserId: string;
  sharerUsername: string;
  description: string;
  sharedAt: FirebaseFirestore.Timestamp;
  gameDate: FirebaseFirestore.Timestamp;
  metadata: unknown;
  gameData?: SharedGameDataLegacy;
}

interface SharedGameSubDocument {
  index: number;
  type: "single" | "match";
  data: SingleGameData | MatchGameData;
}

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const SHARED_GAMES_COLLECTION = "sharedGames";
const GAMES_SUBCOLLECTION = "games";
const TARGET_SCHEMA_VERSION = 2;
// Note: Firestore batches are limited to 500 operations, but our migration
// typically processes one document at a time within its own batch.

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function log(message: string, ...args: unknown[]): void {
  console.log(`[${new Date().toISOString()}] ${message}`, ...args);
}

function logError(message: string, ...args: unknown[]): void {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`, ...args);
}

/* -------------------------------------------------------------------------- */
/* Migration Logic                                                            */
/* -------------------------------------------------------------------------- */

interface MigrationStats {
  total: number;
  alreadyMigrated: number;
  migrated: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

async function migrateDocument(
  db: FirebaseFirestore.Firestore,
  docData: SharedGameDocumentLegacy,
  docRef: FirebaseFirestore.DocumentReference,
  dryRun: boolean,
): Promise<boolean> {
  const { id, type, gameData } = docData;

  if (!gameData) {
    logError(`Document ${id} is missing gameData - cannot migrate`);
    return false;
  }

  log(`Migrating document ${id} (type: ${type})...`);

  // Prepare subcollection documents
  const subDocs: Array<{ index: string; data: SharedGameSubDocument }> = [];

  if (type === "game") {
    const legacyData = gameData as { type: "game"; game: SingleGameData };
    subDocs.push({
      index: "0",
      data: {
        index: 0,
        type: "single",
        data: legacyData.game,
      },
    });
  } else {
    // match or partnerGames
    const legacyData = gameData as { type: "match" | "partnerGames"; games: MatchGameData[] };
    for (let i = 0; i < legacyData.games.length; i++) {
      subDocs.push({
        index: String(i),
        data: {
          index: i,
          type: "match",
          data: legacyData.games[i]!,
        },
      });
    }
  }

  log(`  - Creating ${subDocs.length} game document(s) in subcollection`);

  if (dryRun) {
    log(`  - [DRY RUN] Would update main document to schemaVersion ${TARGET_SCHEMA_VERSION}`);
    log(`  - [DRY RUN] Would remove gameData field`);
    return true;
  }

  // Use batch write for atomicity
  const batch = db.batch();

  // Create subcollection documents
  for (const subDoc of subDocs) {
    const subDocRef = docRef.collection(GAMES_SUBCOLLECTION).doc(subDoc.index);
    batch.set(subDocRef, subDoc.data);
  }

  // Update main document: set schemaVersion and remove gameData
  batch.update(docRef, {
    schemaVersion: TARGET_SCHEMA_VERSION,
    gameData: FieldValue.delete(),
  });

  await batch.commit();
  log(`  - Successfully migrated document ${id}`);

  return true;
}

async function runMigration(dryRun: boolean): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    alreadyMigrated: 0,
    migrated: 0,
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

    // Initialize with service account credentials from environment variables
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        // Handle escaped newlines in the private key
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
      projectId,
    });
  }

  const db = getFirestore();

  log("Starting migration...");
  log(`Dry run: ${dryRun}`);
  log(`Target schema version: ${TARGET_SCHEMA_VERSION}`);
  log("");

  // Fetch all shared games
  const snapshot = await db.collection(SHARED_GAMES_COLLECTION).get();
  stats.total = snapshot.size;

  log(`Found ${stats.total} shared game document(s)`);
  log("");

  // Process each document
  for (const docSnap of snapshot.docs) {
    const docData = docSnap.data() as SharedGameDocumentLegacy;
    const docRef = docSnap.ref;

    // Check if already migrated
    if (docData.schemaVersion === TARGET_SCHEMA_VERSION) {
      log(`Skipping ${docData.id} - already at schema version ${TARGET_SCHEMA_VERSION}`);
      stats.alreadyMigrated++;
      continue;
    }

    // Check if document has gameData (required for migration)
    if (!docData.gameData) {
      // This might be a v2 document without schemaVersion set, or corrupted
      logError(`Document ${docData.id} has no gameData - checking subcollection...`);

      // Check if subcollection exists
      const subSnapshot = await docRef.collection(GAMES_SUBCOLLECTION).limit(1).get();
      if (!subSnapshot.empty) {
        // Has subcollection but missing schemaVersion - just update version
        log(`  - Subcollection exists, updating schemaVersion only`);
        if (!dryRun) {
          await docRef.update({ schemaVersion: TARGET_SCHEMA_VERSION });
        }
        stats.migrated++;
        continue;
      }

      // No gameData and no subcollection - this is a problem
      stats.failed++;
      stats.errors.push({
        id: docData.id,
        error: "No gameData and no subcollection - document is corrupted",
      });
      continue;
    }

    // Migrate the document
    try {
      const success = await migrateDocument(db, docData, docRef, dryRun);
      if (success) {
        stats.migrated++;
      } else {
        stats.failed++;
        stats.errors.push({
          id: docData.id,
          error: "Migration returned false",
        });
      }
    } catch (err) {
      stats.failed++;
      const errorMessage = err instanceof Error ? err.message : String(err);
      stats.errors.push({
        id: docData.id,
        error: errorMessage,
      });
      logError(`Failed to migrate ${docData.id}:`, errorMessage);
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
  console.log("Shared Games Schema Migration: v1 → v2");
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
    console.log("Migration Summary");
    console.log("=".repeat(80));
    console.log(`Total documents:      ${stats.total}`);
    console.log(`Already migrated:     ${stats.alreadyMigrated}`);
    console.log(`Migrated this run:    ${stats.migrated}`);
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
      console.log("✅ Migration completed");
    }

    // Exit with error code if there were failures
    if (stats.failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("");
    console.error("❌ Migration failed with error:");
    console.error(err);
    process.exit(1);
  }
}

main();
