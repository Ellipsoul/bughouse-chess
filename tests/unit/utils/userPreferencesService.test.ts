import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getBoardAnnotationColorFromLocalStorage,
  saveBoardAnnotationColorToLocalStorage,
  removeBoardAnnotationColorFromLocalStorage,
  getAutoAdvanceLiveReplayFromLocalStorage,
  saveAutoAdvanceLiveReplayToLocalStorage,
  removeAutoAdvanceLiveReplayFromLocalStorage,
  loadUserPreferencesFromFirestore,
  saveUserPreferencesToFirestore,
  loadBoardAnnotationColor,
  loadAutoAdvanceLiveReplayPreference,
  DEFAULT_BOARD_ANNOTATION_COLOR,
  type UserPreferences,
} from "../../../app/utils/userPreferencesService";
import { doc, getDoc, setDoc } from "firebase/firestore";
import type { Firestore, DocumentReference, DocumentSnapshot } from "firebase/firestore";
import { getFirestoreDb } from "../../../app/utils/firebaseClient";

// Mock Firebase
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock("../../../app/utils/firebaseClient", () => ({
  getFirestoreDb: vi.fn(),
}));

function createStorageMock(initial: Record<string, string> = {}): {
  storage: Storage;
  data: Map<string, string>;
} {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    data,
    storage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
      clear: () => void data.clear(),
      key: (index: number) => Array.from(data.keys())[index] ?? null,
      get length() {
        return data.size;
      },
    } as Storage,
  };
}

describe("userPreferencesService - localStorage operations", () => {
  beforeEach(() => {
    // Reset localStorage mocks
    vi.clearAllMocks();
  });

  describe("getBoardAnnotationColorFromLocalStorage", () => {
    it("returns default color when localStorage is empty", () => {
      const { storage } = createStorageMock();
      // Mock window.localStorage
      Object.defineProperty(window, "localStorage", {
        value: storage,
        writable: true,
      });

      const color = getBoardAnnotationColorFromLocalStorage();
      expect(color).toBe(DEFAULT_BOARD_ANNOTATION_COLOR);
    });

    it("returns stored color from localStorage", () => {
      const customColor = "rgb(255, 0, 0, 0.95)";
      const { storage } = createStorageMock({
        "bh-board-annotation-color": customColor,
      });
      Object.defineProperty(window, "localStorage", {
        value: storage,
        writable: true,
      });

      const color = getBoardAnnotationColorFromLocalStorage();
      expect(color).toBe(customColor);
    });

    it("handles localStorage errors gracefully", () => {
      const errorStorage = {
        getItem: () => {
          throw new Error("Storage quota exceeded");
        },
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      } as unknown as Storage;
      Object.defineProperty(window, "localStorage", {
        value: errorStorage,
        writable: true,
      });

      // Should not throw and return default
      const color = getBoardAnnotationColorFromLocalStorage();
      expect(color).toBe(DEFAULT_BOARD_ANNOTATION_COLOR);
    });
  });

  describe("saveBoardAnnotationColorToLocalStorage", () => {
    it("saves color to localStorage", () => {
      const { storage, data } = createStorageMock();
      Object.defineProperty(window, "localStorage", {
        value: storage,
        writable: true,
      });

      const customColor = "rgb(255, 0, 0, 0.95)";
      saveBoardAnnotationColorToLocalStorage(customColor);

      expect(data.get("bh-board-annotation-color")).toBe(customColor);
    });

    it("handles localStorage errors gracefully", () => {
      const errorStorage = {
        getItem: () => null,
        setItem: () => {
          throw new Error("Storage quota exceeded");
        },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      } as unknown as Storage;
      Object.defineProperty(window, "localStorage", {
        value: errorStorage,
        writable: true,
      });

      // Should not throw
      expect(() => {
        saveBoardAnnotationColorToLocalStorage("rgb(255, 0, 0, 0.95)");
      }).not.toThrow();
    });
  });

  describe("removeBoardAnnotationColorFromLocalStorage", () => {
    it("removes color from localStorage", () => {
      const { storage, data } = createStorageMock({
        "bh-board-annotation-color": "rgb(255, 0, 0, 0.95)",
      });
      Object.defineProperty(window, "localStorage", {
        value: storage,
        writable: true,
      });

      removeBoardAnnotationColorFromLocalStorage();

      expect(data.get("bh-board-annotation-color")).toBeUndefined();
    });

    it("handles localStorage errors gracefully", () => {
      const errorStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {
          throw new Error("Storage error");
        },
        clear: () => {},
        key: () => null,
        length: 0,
      } as unknown as Storage;
      Object.defineProperty(window, "localStorage", {
        value: errorStorage,
        writable: true,
      });

      // Should not throw
      expect(() => {
        removeBoardAnnotationColorFromLocalStorage();
      }).not.toThrow();
    });
  });

  describe("getAutoAdvanceLiveReplayFromLocalStorage", () => {
    it("returns null when localStorage has no preference", () => {
      const { storage } = createStorageMock();
      Object.defineProperty(window, "localStorage", {
        value: storage,
        writable: true,
      });

      const preference = getAutoAdvanceLiveReplayFromLocalStorage();
      expect(preference).toBeNull();
    });

    it("returns true when preference is stored", () => {
      const { storage } = createStorageMock({
        "bh-auto-advance-live-replay": "true",
      });
      Object.defineProperty(window, "localStorage", {
        value: storage,
        writable: true,
      });

      const preference = getAutoAdvanceLiveReplayFromLocalStorage();
      expect(preference).toBe(true);
    });

    it("returns false when preference is stored", () => {
      const { storage } = createStorageMock({
        "bh-auto-advance-live-replay": "false",
      });
      Object.defineProperty(window, "localStorage", {
        value: storage,
        writable: true,
      });

      const preference = getAutoAdvanceLiveReplayFromLocalStorage();
      expect(preference).toBe(false);
    });
  });

  describe("saveAutoAdvanceLiveReplayToLocalStorage", () => {
    it("saves preference to localStorage", () => {
      const { storage, data } = createStorageMock();
      Object.defineProperty(window, "localStorage", {
        value: storage,
        writable: true,
      });

      saveAutoAdvanceLiveReplayToLocalStorage(true);

      expect(data.get("bh-auto-advance-live-replay")).toBe("true");
    });

    it("handles localStorage errors gracefully", () => {
      const errorStorage = {
        getItem: () => null,
        setItem: () => {
          throw new Error("Storage quota exceeded");
        },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      } as unknown as Storage;
      Object.defineProperty(window, "localStorage", {
        value: errorStorage,
        writable: true,
      });

      expect(() => {
        saveAutoAdvanceLiveReplayToLocalStorage(false);
      }).not.toThrow();
    });
  });

  describe("removeAutoAdvanceLiveReplayFromLocalStorage", () => {
    it("removes preference from localStorage", () => {
      const { storage, data } = createStorageMock({
        "bh-auto-advance-live-replay": "true",
      });
      Object.defineProperty(window, "localStorage", {
        value: storage,
        writable: true,
      });

      removeAutoAdvanceLiveReplayFromLocalStorage();

      expect(data.get("bh-auto-advance-live-replay")).toBeUndefined();
    });
  });
});

describe("userPreferencesService - Firestore operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loadUserPreferencesFromFirestore", () => {
    it("returns null when document does not exist", async () => {
      const mockDb = {} as Firestore;
      const mockDocRef = {} as DocumentReference;
      const mockDocSnap = {
        exists: () => false,
      } as DocumentSnapshot;

      vi.mocked(getFirestoreDb).mockReturnValue(mockDb);
      vi.mocked(doc).mockReturnValue(mockDocRef);
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap);

      const result = await loadUserPreferencesFromFirestore("user123");

      expect(result).toBeNull();
      expect(doc).toHaveBeenCalledWith(mockDb, "users", "user123", "userPreferences", "settings");
      expect(getDoc).toHaveBeenCalledWith(mockDocRef);
    });

    it("returns preferences when document exists", async () => {
      const mockDb = {} as Firestore;
      const mockDocRef = {} as DocumentReference;
      const customColor = "rgb(255, 0, 0, 0.95)";
      const autoAdvanceLiveReplay = true;
      const mockDocSnap = {
        exists: () => true,
        data: () => ({
          boardAnnotationColor: customColor,
          autoAdvanceLiveReplay,
        }),
      } as unknown as DocumentSnapshot;

      vi.mocked(getFirestoreDb).mockReturnValue(mockDb);
      vi.mocked(doc).mockReturnValue(mockDocRef);
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap);

      const result = await loadUserPreferencesFromFirestore("user123");

      expect(result).toEqual({
        boardAnnotationColor: customColor,
        autoAdvanceLiveReplay,
      });
    });

    it("returns default color when document exists but field is missing", async () => {
      const mockDb = {} as Firestore;
      const mockDocRef = {} as DocumentReference;
      const mockDocSnap = {
        exists: () => true,
        data: () => ({}),
      } as unknown as DocumentSnapshot;

      vi.mocked(getFirestoreDb).mockReturnValue(mockDb);
      vi.mocked(doc).mockReturnValue(mockDocRef);
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap);

      const result = await loadUserPreferencesFromFirestore("user123");

      expect(result).toEqual({
        boardAnnotationColor: DEFAULT_BOARD_ANNOTATION_COLOR,
        autoAdvanceLiveReplay: false,
      });
    });

    it("handles errors gracefully", async () => {
      const mockDb = {} as Firestore;
      const mockDocRef = {} as DocumentReference;

      vi.mocked(getFirestoreDb).mockReturnValue(mockDb);
      vi.mocked(doc).mockReturnValue(mockDocRef);
      vi.mocked(getDoc).mockRejectedValue(new Error("Firestore error"));

      const result = await loadUserPreferencesFromFirestore("user123");

      expect(result).toBeNull();
    });
  });

  describe("saveUserPreferencesToFirestore", () => {
    it("saves preferences to Firestore", async () => {
      const mockDb = {} as Firestore;
      const mockDocRef = {} as DocumentReference;
      const preferences: UserPreferences = {
        boardAnnotationColor: "rgb(255, 0, 0, 0.95)",
        autoAdvanceLiveReplay: false,
      };

      vi.mocked(getFirestoreDb).mockReturnValue(mockDb);
      vi.mocked(doc).mockReturnValue(mockDocRef);
      vi.mocked(setDoc).mockResolvedValue(undefined);

      await saveUserPreferencesToFirestore("user123", preferences);

      expect(doc).toHaveBeenCalledWith(mockDb, "users", "user123", "userPreferences", "settings");
      expect(setDoc).toHaveBeenCalledWith(mockDocRef, preferences, { merge: true });
    });

    it("throws error when Firestore save fails", async () => {
      const mockDb = {} as Firestore;
      const mockDocRef = {} as DocumentReference;
      const preferences: UserPreferences = {
        boardAnnotationColor: "rgb(255, 0, 0, 0.95)",
        autoAdvanceLiveReplay: true,
      };

      vi.mocked(getFirestoreDb).mockReturnValue(mockDb);
      vi.mocked(doc).mockReturnValue(mockDocRef);
      vi.mocked(setDoc).mockRejectedValue(new Error("Firestore error"));

      await expect(saveUserPreferencesToFirestore("user123", preferences)).rejects.toThrow(
        "Firestore error",
      );
    });
  });
});

describe("userPreferencesService - unified loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loadBoardAnnotationColor", () => {
    it("returns localStorage value when present", async () => {
      const customColor = "rgb(255, 0, 0, 0.95)";
      const { storage } = createStorageMock({
        "bh-board-annotation-color": customColor,
      });
      Object.defineProperty(window, "localStorage", {
        value: storage,
        writable: true,
      });

      const color = await loadBoardAnnotationColor("user123");

      expect(color).toBe(customColor);
      // Should not call Firestore when localStorage has value
      expect(getDoc).not.toHaveBeenCalled();
    });

    it("loads from Firestore when localStorage is empty and user is authenticated", async () => {
      const { storage } = createStorageMock();
      Object.defineProperty(window, "localStorage", {
        value: storage,
        writable: true,
      });

      const customColor = "rgb(255, 0, 0, 0.95)";
      const mockDb = {} as Firestore;
      const mockDocRef = {} as DocumentReference;
      const mockDocSnap = {
        exists: () => true,
        data: () => ({
          boardAnnotationColor: customColor,
        }),
      } as unknown as DocumentSnapshot;

      vi.mocked(getFirestoreDb).mockReturnValue(mockDb);
      vi.mocked(doc).mockReturnValue(mockDocRef);
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap);

      const color = await loadBoardAnnotationColor("user123");

      expect(color).toBe(customColor);
      expect(getDoc).toHaveBeenCalled();
      // Should sync to localStorage
      expect(storage.getItem("bh-board-annotation-color")).toBe(customColor);
    });

    it("returns default when localStorage is empty and user is not authenticated", async () => {
      const { storage } = createStorageMock();
      Object.defineProperty(window, "localStorage", {
        value: storage,
        writable: true,
      });

      const color = await loadBoardAnnotationColor(null);

      expect(color).toBe(DEFAULT_BOARD_ANNOTATION_COLOR);
      expect(getDoc).not.toHaveBeenCalled();
    });

    it("returns default when localStorage is empty and Firestore document does not exist", async () => {
      const { storage } = createStorageMock();
      Object.defineProperty(window, "localStorage", {
        value: storage,
        writable: true,
      });

      const mockDb = {} as Firestore;
      const mockDocRef = {} as DocumentReference;
      const mockDocSnap = {
        exists: () => false,
      } as unknown as DocumentSnapshot;

      vi.mocked(getFirestoreDb).mockReturnValue(mockDb);
      vi.mocked(doc).mockReturnValue(mockDocRef);
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap);

      const color = await loadBoardAnnotationColor("user123");

      expect(color).toBe(DEFAULT_BOARD_ANNOTATION_COLOR);
    });

    it("handles Firestore errors gracefully and returns default", async () => {
      const { storage } = createStorageMock();
      Object.defineProperty(window, "localStorage", {
        value: storage,
        writable: true,
      });

      const mockDb = {} as Firestore;
      const mockDocRef = {} as DocumentReference;

      vi.mocked(getFirestoreDb).mockReturnValue(mockDb);
      vi.mocked(doc).mockReturnValue(mockDocRef);
      vi.mocked(getDoc).mockRejectedValue(new Error("Firestore error"));

      const color = await loadBoardAnnotationColor("user123");

      expect(color).toBe(DEFAULT_BOARD_ANNOTATION_COLOR);
    });
  });

  describe("loadAutoAdvanceLiveReplayPreference", () => {
    it("returns localStorage value when present", async () => {
      const { storage } = createStorageMock({
        "bh-auto-advance-live-replay": "false",
      });
      Object.defineProperty(window, "localStorage", {
        value: storage,
        writable: true,
      });

      const preference = await loadAutoAdvanceLiveReplayPreference("user123");

      expect(preference).toBe(false);
      expect(getDoc).not.toHaveBeenCalled();
    });

    it("loads from Firestore when localStorage is empty and user is authenticated", async () => {
      const { storage } = createStorageMock();
      Object.defineProperty(window, "localStorage", {
        value: storage,
        writable: true,
      });

      const mockDb = {} as Firestore;
      const mockDocRef = {} as DocumentReference;
      const mockDocSnap = {
        exists: () => true,
        data: () => ({
          autoAdvanceLiveReplay: true,
        }),
      } as unknown as DocumentSnapshot;

      vi.mocked(getFirestoreDb).mockReturnValue(mockDb);
      vi.mocked(doc).mockReturnValue(mockDocRef);
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap);

      const preference = await loadAutoAdvanceLiveReplayPreference("user123");

      expect(preference).toBe(true);
      expect(getDoc).toHaveBeenCalled();
      expect(storage.getItem("bh-auto-advance-live-replay")).toBe("true");
    });

    it("returns default when localStorage is empty and user is not authenticated", async () => {
      const { storage } = createStorageMock();
      Object.defineProperty(window, "localStorage", {
        value: storage,
        writable: true,
      });

      const preference = await loadAutoAdvanceLiveReplayPreference(null);

      expect(preference).toBe(false);
      expect(getDoc).not.toHaveBeenCalled();
    });

    it("returns default when localStorage is empty and Firestore document does not exist", async () => {
      const { storage } = createStorageMock();
      Object.defineProperty(window, "localStorage", {
        value: storage,
        writable: true,
      });

      const mockDb = {} as Firestore;
      const mockDocRef = {} as DocumentReference;
      const mockDocSnap = {
        exists: () => false,
      } as unknown as DocumentSnapshot;

      vi.mocked(getFirestoreDb).mockReturnValue(mockDb);
      vi.mocked(doc).mockReturnValue(mockDocRef);
      vi.mocked(getDoc).mockResolvedValue(mockDocSnap);

      const preference = await loadAutoAdvanceLiveReplayPreference("user123");

      expect(preference).toBe(false);
    });

    it("handles Firestore errors gracefully and returns default", async () => {
      const { storage } = createStorageMock();
      Object.defineProperty(window, "localStorage", {
        value: storage,
        writable: true,
      });

      const mockDb = {} as Firestore;
      const mockDocRef = {} as DocumentReference;

      vi.mocked(getFirestoreDb).mockReturnValue(mockDb);
      vi.mocked(doc).mockReturnValue(mockDocRef);
      vi.mocked(getDoc).mockRejectedValue(new Error("Firestore error"));

      const preference = await loadAutoAdvanceLiveReplayPreference("user123");

      expect(preference).toBe(false);
    });
  });
});
