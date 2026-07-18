import { describe, expect, it } from "vitest";

import { validateSeatConfiguration, venueLayoutPayloadSchema, venueLayoutTemplateInputSchema } from "@shime/core";

const tables = [
  { tableCode: "T01", capacity: 2, displayOrder: 1, seats: [{ seatCode: "T01-1" }, { seatCode: "T01-2" }] },
];

describe("venue layout template contract", () => {
  it("accepts a versioned reusable layout payload", () => {
    expect(venueLayoutPayloadSchema.parse({ schemaVersion: 1, tables })).toEqual({ schemaVersion: 1, tables });
    expect(venueLayoutTemplateInputSchema.parse({ name: "第1会場", tables }).name).toBe("第1会場");
  });

  it("rejects an unknown payload version", () => {
    expect(() => venueLayoutPayloadSchema.parse({ schemaVersion: 2, tables })).toThrow();
  });

  it("applies the same deterministic seat validation used by events", () => {
    expect(() => validateSeatConfiguration([...tables, { ...tables[0]!, displayOrder: 2 }], 4)).toThrow("Table codes");
  });
});
