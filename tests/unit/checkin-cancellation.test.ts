import { describe, expect, it } from "vitest";
import { buildCheckinCancellationReason } from "@shime/core";

describe("check-in cancellation reasons", () => {
  it("uses a preset without requiring keyboard input", () => {
    expect(buildCheckinCancellationReason("参加者都合")).toBe("参加者都合");
  });

  it("appends an optional short note", () => {
    expect(buildCheckinCancellationReason("受付操作の訂正", " 対象者を取り違えた ")).toBe("受付操作の訂正: 対象者を取り違えた");
  });

  it("requires a note only for the other preset", () => {
    expect(() => buildCheckinCancellationReason("その他")).toThrow();
  });
});
