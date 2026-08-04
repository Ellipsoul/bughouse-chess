/**
 * Unit tests for shared-game description tooltip helper (`sharedGameDescription.ts`).
 *
 * Returns null for empty descriptions; otherwise surfaces full text for truncation UI.
 */
import { describe, it, expect } from "vitest";
import { getSharedGameDescriptionTooltip } from "@/app/utils/shared-games/sharedGameDescription";

describe("getSharedGameDescriptionTooltip", () => {
  it("returns null when description is empty", () => {
    expect(getSharedGameDescriptionTooltip("   ")).toBeNull();
  });

  it("returns null when description is missing", () => {
    expect(getSharedGameDescriptionTooltip(null)).toBeNull();
  });

  it("prefixes the trimmed description", () => {
    expect(getSharedGameDescriptionTooltip("  Tactics galore  ")).toBe(
      "Description: Tactics galore",
    );
  });
});
