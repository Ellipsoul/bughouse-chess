import { describe, it, expect } from "vitest";
import { getSharedGameDescriptionTooltip } from "../../../app/utils/sharedGameDescription";

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
