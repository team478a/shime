import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseApplicationCsv } from "@shime/core";

const fixturePath = new URL("../../docs/shime/REHEARSAL_APPLICATIONS_12.csv", import.meta.url);

describe("rehearsal application fixture", () => {
  it("contains twelve valid, unique, explicitly synthetic participants", async () => {
    const content = await readFile(fixturePath, "utf8");
    const result = parseApplicationCsv(content);
    expect(result.rows).toHaveLength(12);
    expect(result.rows.every((row) => row.level === "valid")).toBe(true);
    expect(new Set(result.rows.map((row) => row.data?.externalId)).size).toBe(12);
    expect(result.rows.every((row) => row.data?.notes === "SYNTHETIC_REHEARSAL_ONLY")).toBe(true);
    expect(result.rows.every((row) => row.data?.email?.endsWith("@example.invalid"))).toBe(true);
  });

  it("keeps the three isolated scenarios balanced across participant categories", async () => {
    const result = parseApplicationCsv(await readFile(fixturePath, "utf8"));
    for (const scenario of ["RH-A", "RH-B", "RH-C"]) {
      const rows = result.rows.filter((row) => row.data?.externalId?.startsWith(scenario));
      expect(rows).toHaveLength(4);
      expect(rows.filter((row) => row.data?.participantCategory === "group_a")).toHaveLength(2);
      expect(rows.filter((row) => row.data?.participantCategory === "group_b")).toHaveLength(2);
    }
  });
});
