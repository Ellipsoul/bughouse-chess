import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePieceValuePreset } from "@/app/utils/preferences/usePieceValuePreset";
import { savePieceValuePresetToLocalStorage } from "@/app/utils/preferences/userPreferencesService";

describe("usePieceValuePreset", () => {
  it("updates same-tab subscribers when the saved preset changes", () => {
    localStorage.clear();
    const { result } = renderHook(() => usePieceValuePreset());

    expect(result.current).toBe("bughouse");

    act(() => {
      savePieceValuePresetToLocalStorage("standard");
    });

    expect(result.current).toBe("standard");
  });
});
