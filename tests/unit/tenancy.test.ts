import { describe, expect, it } from "vitest";
import { requireSameEvent, requireSameTenant } from "@shime/core";

describe("tenant and event boundaries", () => {
  const scope = { tenantId: "tenant-a", eventId: "event-a" };
  it("accepts matching scope", () => expect(() => requireSameTenant(scope, "tenant-a")).not.toThrow());
  it("hides cross-tenant resources", () => expect(() => requireSameTenant(scope, "tenant-b")).toThrow(/not found/));
  it("hides cross-event resources", () => expect(() => requireSameEvent(scope, "event-b")).toThrow(/not found/));
});
