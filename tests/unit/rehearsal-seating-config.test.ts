import { describe, expect, it } from "vitest";

import { parseRehearsalSeatingSetup } from "../../scripts/rehearsal-seating-config";

describe("rehearsal seating setup arguments", () => {
  it("accepts explicit rehearsal-only identifiers", () => {
    expect(parseRehearsalSeatingSetup(["--event-code", "rh-a-20260715", "--external-id", "RH-A02"])).toEqual({
      eventCode: "rh-a-20260715",
      externalId: "RH-A02",
    });
  });

  it("rejects production-like and missing identifiers", () => {
    expect(() => parseRehearsalSeatingSetup(["--event-code", "shime-20260808", "--external-id", "RH-A02"])).toThrow(
      "VALID_REHEARSAL_EVENT_CODE_REQUIRED",
    );
    expect(() => parseRehearsalSeatingSetup(["--event-code", "rh-a-20260715"])).toThrow(
      "VALID_SYNTHETIC_EXTERNAL_ID_REQUIRED",
    );
  });
});
