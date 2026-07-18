import { describe, expect, it } from "vitest";
import { buildEventSetupSections } from "../../apps/web/src/server/event-setup";

describe("event setup sections", () => {
  it("groups pending items under their management screens", () => {
    const sections = buildEventSetupSections("event-1", [
      { key: "venueName", label: "会場名", kind: "missing" },
      { key: "eventSeats", label: "有効な席", kind: "missing" },
      { key: "questionnaire", label: "席案内5問設定", kind: "missing" },
      { key: "privacyDocument", label: "公開済みプライバシーポリシー", kind: "missing" },
    ]);
    expect(sections.find((section) => section.key === "basic")?.issues).toHaveLength(1);
    expect(sections.find((section) => section.key === "tables")?.href).toBe("/admin/events/event-1/tables");
    expect(sections.find((section) => section.key === "questionnaire")?.complete).toBe(false);
    expect(sections.find((section) => section.key === "dream")?.complete).toBe(true);
    expect(sections.find((section) => section.key === "legal")?.href).toBe("/admin/events/event-1/legal");
    expect(sections.find((section) => section.key === "legal")?.complete).toBe(false);
  });
});
