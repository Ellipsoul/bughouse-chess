// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import admin from "firebase-admin";
import { getAdminFirestore } from "@/app/utils/platform/firebaseAdmin";

vi.mock("server-only", () => ({}));
vi.mock("firebase-admin", () => ({ default: {
  apps: [], initializeApp: vi.fn(), firestore: vi.fn(() => ({ kind: "test-db" })),
  credential: { cert: vi.fn(() => "test-credential") },
} }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("FIREBASE_PROJECT_ID", "demo-bughouse");
  vi.stubEnv("FIREBASE_CLIENT_EMAIL", "");
  vi.stubEnv("FIREBASE_PRIVATE_KEY", "");
  vi.stubEnv("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080");
});
afterEach(() => vi.unstubAllEnvs());

it("uses a demo emulator without service account credentials", () => {
  getAdminFirestore();
  expect(admin.initializeApp).toHaveBeenCalledWith({ projectId: "demo-bughouse" });
  expect(admin.credential.cert).not.toHaveBeenCalled();
});

it("still requires credentials without an emulator", () => {
  vi.stubEnv("FIRESTORE_EMULATOR_HOST", "");
  expect(() => getAdminFirestore()).toThrow("Missing Firebase Admin env vars");
  expect(admin.initializeApp).not.toHaveBeenCalled();
});

it("does not waive credentials for a non-demo project", () => {
  vi.stubEnv("FIREBASE_PROJECT_ID", "production-example");
  expect(() => getAdminFirestore()).toThrow("Missing Firebase Admin env vars");
  expect(admin.initializeApp).not.toHaveBeenCalled();
});
