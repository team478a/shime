import { describe, expect, it } from "vitest";

import { getEventIdFromSearch } from "../../apps/web/src/lib/liff-location";

describe("LIFF location", () => {
  it("reads and decodes the event ID", () => {
    expect(getEventIdFromSearch("?eventId=event%2F2026&token=secret")).toBe("event/2026");
  });

  it("returns an empty value when the event ID is missing", () => {
    expect(getEventIdFromSearch("?token=secret")).toBe("");
  });
});
