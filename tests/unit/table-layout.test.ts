import { describe, expect, it } from "vitest";

import { generateTableLayout, parseTableLayoutCsv, templateNameAfterSourceCopy, validateTableLayout } from "../../apps/web/src/lib/table-layout";
import { canonicalizeVenueLayoutTables, nextVenueLayoutTemplateVersion } from "../../packages/core/src/templates/venue-layout";

describe("table layout setup", () => {
  it("generates numbered tables and seats", () => {
    expect(generateTableLayout({ prefix: "T", firstTableNumber: 1, tableCount: 2, seatsPerTable: 3 })).toEqual([
      { tableCode: "T01", capacity: 3, seats: "T01-1, T01-2, T01-3" },
      { tableCode: "T02", capacity: 3, seats: "T02-1, T02-2, T02-3" },
    ]);
  });

  it("groups one-seat-per-row CSV records into tables", () => {
    const result = parseTableLayoutCsv("table_code,capacity,seat_code\nT01,2,T01-1\nT01,2,T01-2\nT02,1,T02-1\n");
    expect(result).toEqual([
      { tableCode: "T01", capacity: 2, seats: "T01-1, T01-2" },
      { tableCode: "T02", capacity: 1, seats: "T02-1" },
    ]);
  });

  it("rejects inconsistent CSV capacity", () => {
    expect(() => parseTableLayoutCsv("table_code,capacity,seat_code\nT01,2,T01-1\nT01,3,T01-2\n")).toThrow("T01の定員");
  });

  it("reports duplicate and capacity problems before save", () => {
    const result = validateTableLayout([
      { tableCode: "T01", capacity: 1, seats: "S01, S02" },
      { tableCode: "T02", capacity: 2, seats: "S02" },
    ], 4);
    expect(result.errors).toEqual(expect.arrayContaining(["席コードが重複しています。", "T01の席数が定員を超えています。"]));
    expect(result.warnings).toEqual(["イベント定員4名に対して、席が3席です。"]);
  });

  it("canonicalizes equivalent venue layout snapshots deterministically", () => {
    const first = [
      { tableCode: "T02", capacity: 1, displayOrder: 2, seats: [{ seatCode: "T02-1" }] },
      { tableCode: "T01", capacity: 2, displayOrder: 1, seats: [{ seatCode: "T01-2" }, { seatCode: "T01-1" }] },
    ];
    const second = [first[1]!, first[0]!].map((table) => ({ ...table, seats: [...table.seats].reverse() }));
    expect(canonicalizeVenueLayoutTables(first)).toBe(canonicalizeVenueLayoutTables(second));
  });

  it("reuses the exact template name after copying a template source", () => {
    expect(templateNameAfterSourceCopy("会場A レイアウト", {
      id: "template:1",
      kind: "template",
      label: "検証会場 4席（v3）",
      templateId: "1",
      templateName: "検証会場 4席",
      rows: [],
    })).toBe("検証会場 4席");
    expect(templateNameAfterSourceCopy("会場A レイアウト", { id: "event:1", kind: "event", label: "過去イベント", rows: [] })).toBe("会場A レイアウト");
  });

  it("increments venue layout versions without using the display name", () => {
    expect(nextVenueLayoutTemplateVersion()).toBe(1);
    expect(nextVenueLayoutTemplateVersion(2)).toBe(3);
    expect(() => nextVenueLayoutTemplateVersion(0)).toThrow();
  });
});
