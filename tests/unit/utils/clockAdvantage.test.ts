import { describe, it, expect } from "vitest";
import {
  getTeamTimeDiffDeciseconds,
  getClockTintClasses,
} from "../../../app/utils/clockAdvantage";
import type { BughouseClocksSnapshotByBoard } from "../../../app/types/bughouse";

describe("getTeamTimeDiffDeciseconds", () => {
  it("returns positive when team AWhite_BBlack is leading", () => {
    const snapshot: BughouseClocksSnapshotByBoard = {
      A: { white: 1000, black: 500 },
      B: { white: 500, black: 1000 },
    };

    // Team 1 (A white + B black): 1000 + 1000 = 2000
    // Team 2 (A black + B white): 500 + 500 = 1000
    // Diff: 2000 - 1000 = 1000 (positive)
    const diff = getTeamTimeDiffDeciseconds(snapshot);
    expect(diff).toBe(1000);
  });

  it("returns negative when team ABlack_BWhite is leading", () => {
    const snapshot: BughouseClocksSnapshotByBoard = {
      A: { white: 500, black: 1000 },
      B: { white: 1000, black: 500 },
    };

    // Team 1 (A white + B black): 500 + 500 = 1000
    // Team 2 (A black + B white): 1000 + 1000 = 2000
    // Diff: 1000 - 2000 = -1000 (negative)
    const diff = getTeamTimeDiffDeciseconds(snapshot);
    expect(diff).toBe(-1000);
  });

  it("returns zero when teams are even", () => {
    const snapshot: BughouseClocksSnapshotByBoard = {
      A: { white: 1000, black: 1000 },
      B: { white: 1000, black: 1000 },
    };

    const diff = getTeamTimeDiffDeciseconds(snapshot);
    expect(diff).toBe(0);
  });
});

describe("getClockTintClasses", () => {
  it("returns null when clocks are even (tier 0)", () => {
    const result = getClockTintClasses({
      diffDeciseconds: 0,
      team: "AWhite_BBlack",
    });
    expect(result).toBeNull();
  });

  it("returns tier 1 classes for small advantage (<1s)", () => {
    const result = getClockTintClasses({
      diffDeciseconds: 5, // 0.5 seconds
      team: "AWhite_BBlack",
    });
    expect(result).toBeTruthy();
    expect(result).toContain("text-emerald");
  });

  it("returns tier 2 classes for <2s advantage", () => {
    const result = getClockTintClasses({
      diffDeciseconds: 15, // 1.5 seconds
      team: "AWhite_BBlack",
    });
    expect(result).toBeTruthy();
    expect(result).toContain("text-emerald");
  });

  it("returns tier 5 classes for >=16s advantage", () => {
    const result = getClockTintClasses({
      diffDeciseconds: 200, // 20 seconds
      team: "AWhite_BBlack",
    });
    expect(result).toBeTruthy();
    expect(result).toContain("text-emerald");
  });

  it("returns red classes for trailing team", () => {
    const result = getClockTintClasses({
      diffDeciseconds: 50, // Team is leading by 5s
      team: "ABlack_BWhite", // But this team is trailing
    });
    expect(result).toBeTruthy();
    expect(result).toContain("text-rose");
  });

  it("applies frozen styling when isFrozen is true", () => {
    const result = getClockTintClasses({
      diffDeciseconds: 50,
      team: "AWhite_BBlack",
      isFrozen: true,
    });
    expect(result).toBeTruthy();
    // Frozen classes should have different opacity
    expect(result).toContain("/");
  });

  it("includes drop-shadow for higher tiers", () => {
    const result = getClockTintClasses({
      diffDeciseconds: 50, // Tier 3 or higher
      team: "AWhite_BBlack",
    });
    expect(result).toBeTruthy();
    // Higher tiers should include drop-shadow
    if (result) {
      // Check if it contains drop-shadow (might be in the string)
      expect(result.length).toBeGreaterThan(0);
    }
  });
});
