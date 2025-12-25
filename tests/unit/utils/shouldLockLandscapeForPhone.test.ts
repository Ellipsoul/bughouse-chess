import { describe, expect, it } from "vitest";
import { shouldLockLandscapeForPhone } from "../../../app/utils/pwa/shouldLockLandscapeForPhone";

describe("shouldLockLandscapeForPhone", () => {
  it("returns false when userAgent is null", () => {
    expect(shouldLockLandscapeForPhone(null)).toBe(false);
  });

  it("returns true for Android phone UA (contains Android + Mobile)", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    expect(shouldLockLandscapeForPhone(ua)).toBe(true);
  });

  it("returns false for Android tablet UA (Android but no Mobile token)", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(shouldLockLandscapeForPhone(ua)).toBe(false);
  });

  it("returns false for iPhone UA", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
    expect(shouldLockLandscapeForPhone(ua)).toBe(false);
  });

  it("returns false for iPad UA", () => {
    const ua =
      "Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
    expect(shouldLockLandscapeForPhone(ua)).toBe(false);
  });
});
