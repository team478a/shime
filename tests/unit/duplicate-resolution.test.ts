import { describe, expect, it } from "vitest";
import { buildDuplicateResolutionReason } from "../../apps/web/src/lib/duplicate-resolution";

describe("duplicate resolution reasons", () => {
  it("uses a preset without requiring typing", () => {
    expect(buildDuplicateResolutionReason("same_person", "identity_confirmed", "")).toBe("本人へ確認済み");
  });

  it("requires a note for other and appends an optional note to presets", () => {
    expect(buildDuplicateResolutionReason("on_hold", "other", "")).toBeNull();
    expect(buildDuplicateResolutionReason("on_hold", "other", "書類待ち")).toBe("その他: 書類待ち");
    expect(buildDuplicateResolutionReason("different_person", "same_name", "主催者確認済み")).toContain("主催者確認済み");
  });
});
