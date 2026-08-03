import { describe, expect, it } from "vitest";
import { openingExplorerEnabled } from "@/app/components/opening-explorer/featureFlag";

describe("opening explorer local feature flag", () => {
  it("requires an explicit flag and can never expose the experiment in production", () => {
    expect(openingExplorerEnabled({ nodeEnv: "development", publicFlag: "true" })).toBe(true);
    expect(openingExplorerEnabled({ nodeEnv: "development", publicFlag: undefined })).toBe(false);
    expect(openingExplorerEnabled({ nodeEnv: "production", publicFlag: "true" })).toBe(false);
  });
});
