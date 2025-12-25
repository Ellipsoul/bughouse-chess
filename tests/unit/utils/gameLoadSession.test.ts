import { describe, expect, it } from "vitest";
import {
  hasRecordedGameLoadThisSession,
  markRecordedGameLoadThisSession,
} from "../../../app/utils/metrics/gameLoadSession";

function createInMemoryStorage(): Storage {
  const map = new Map<string, string>();

  // Minimal Storage implementation for our needs.
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  } as Storage;
}

describe("gameLoadSession helpers", () => {
  it("is false before mark, then true after mark for the same gameId", () => {
    const storage = createInMemoryStorage();

    expect(hasRecordedGameLoadThisSession(storage, "160064848971")).toBe(false);
    markRecordedGameLoadThisSession(storage, "160064848971");
    expect(hasRecordedGameLoadThisSession(storage, "160064848971")).toBe(true);
  });

  it("treats different gameIds independently", () => {
    const storage = createInMemoryStorage();

    markRecordedGameLoadThisSession(storage, "A");
    expect(hasRecordedGameLoadThisSession(storage, "A")).toBe(true);
    expect(hasRecordedGameLoadThisSession(storage, "B")).toBe(false);
  });

  it("handles empty gameId defensively", () => {
    const storage = createInMemoryStorage();

    expect(hasRecordedGameLoadThisSession(storage, "")).toBe(false);
    markRecordedGameLoadThisSession(storage, "");
    expect(hasRecordedGameLoadThisSession(storage, "")).toBe(false);
  });
});
