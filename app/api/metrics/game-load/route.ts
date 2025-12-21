import { NextResponse, type NextRequest } from "next/server";
import admin from "firebase-admin";
import { getAdminFirestore } from "../../../utils/firebaseAdmin";

export const runtime = "nodejs";

const METRICS_DOC_PATH = "metrics/global";

type MetricsResponse = {
  gamesLoaded: number;
};

function coerceNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (!Number.isInteger(value)) return null;
  if (value < 0) return null;
  return value;
}

function validateGameId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Chess.com IDs are numeric-ish, but accept alphanumerics for future sources.
  if (trimmed.length > 128) return null;
  return trimmed;
}

async function readOrInitializeGamesLoaded(): Promise<number> {
  const db = getAdminFirestore();
  const docRef = db.doc(METRICS_DOC_PATH);

  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);

    if (!snap.exists) {
      tx.set(docRef, {
        gamesLoaded: 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return 0;
    }

    const maybeCount = coerceNonNegativeInteger(snap.get("gamesLoaded"));
    return maybeCount ?? 0;
  });
}

async function incrementGamesLoaded(): Promise<number> {
  const db = getAdminFirestore();
  const docRef = db.doc(METRICS_DOC_PATH);

  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const current = snap.exists
      ? coerceNonNegativeInteger(snap.get("gamesLoaded")) ?? 0
      : 0;
    const next = current + 1;

    tx.set(
      docRef,
      {
        gamesLoaded: next,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return next;
  });
}

/**
 * Returns the current global `gamesLoaded` counter.
 *
 * This endpoint is intentionally public; it does not reveal private data.
 * Writes remain server-side only via Admin SDK.
 */
export async function GET(): Promise<NextResponse<MetricsResponse>> {
  try {
    const gamesLoaded = await readOrInitializeGamesLoaded();
    return NextResponse.json({ gamesLoaded });
  } catch (err) {
    console.error("GET /api/metrics/game-load failed", err);
    return NextResponse.json({ gamesLoaded: 0 }, { status: 200 });
  }
}

/**
 * Increments the global `gamesLoaded` counter by 1.
 *
 * Body: `{ gameId: string }`
 *
 * The `gameId` is used for validation/telemetry boundaries only. We do not store it
 * in Firestore to keep the metric anonymous and low-cardinality.
 */
export async function POST(request: NextRequest): Promise<NextResponse<MetricsResponse>> {
  try {
    const body: unknown = await request.json().catch(() => null);
    const gameId = validateGameId((body as { gameId?: unknown } | null)?.gameId);
    if (!gameId) {
      return NextResponse.json({ gamesLoaded: 0 }, { status: 400 });
    }

    const gamesLoaded = await incrementGamesLoaded();
    return NextResponse.json({ gamesLoaded });
  } catch (err) {
    console.error("POST /api/metrics/game-load failed", err);
    return NextResponse.json({ gamesLoaded: 0 }, { status: 200 });
  }
}


