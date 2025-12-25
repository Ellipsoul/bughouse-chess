import { describe, expect, it } from "vitest";
import {
  setSkipLoadGameOverrideConfirm,
  shouldSkipLoadGameOverrideConfirm,
} from "../../../app/utils/loadGameOverrideConfirmPreference";

function createStorageMock(initial: Record<string, string> = {}): {
  storage: Pick<Storage, "getItem" | "setItem">;
  data: Map<string, string>;
} {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    data,
    storage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    },
  };
}

describe("loadGameOverrideConfirmPreference", () => {
  it("defaults to showing the warning when not set", () => {
    const { storage } = createStorageMock();
    expect(shouldSkipLoadGameOverrideConfirm(storage)).toBe(false);
  });

  it("treats '1' as opted out", () => {
    const { storage } = createStorageMock({ "bughouse:ui:skipLoadGameOverrideConfirm": "1" });
    expect(shouldSkipLoadGameOverrideConfirm(storage)).toBe(true);
  });

  it("writes opt-out state when value is true", () => {
    const { storage, data } = createStorageMock();
    setSkipLoadGameOverrideConfirm(storage, true);
    expect(data.get("bughouse:ui:skipLoadGameOverrideConfirm")).toBe("1");
  });

  it("does not write when value is false", () => {
    const { storage, data } = createStorageMock();
    setSkipLoadGameOverrideConfirm(storage, false);
    expect(data.get("bughouse:ui:skipLoadGameOverrideConfirm")).toBe(undefined);
  });
});
