import { describe, expect, it } from "vitest";
import { hasPermission, parsePermissions, permissionsForRole } from "@shime/core";

describe("staff permissions", () => {
  it("does not expose preferences to reception", () =>
    expect(hasPermission("reception", "preference:read")).toBe(false));
  it("does not let operators confirm results", () => expect(hasPermission("operator", "result:confirm")).toBe(false));
  it("lets managers publish seating", () => expect(hasPermission("manager", "seating:publish")).toBe(true));
  it("keeps unilateral preference exports manager-only", () => {
    expect(hasPermission("operator", "backup:export")).toBe(true);
    expect(hasPermission("operator", "backup:sensitive")).toBe(false);
    expect(hasPermission("manager", "backup:sensitive")).toBe(true);
  });
  it("only lets system administrators revoke results", () => {
    expect(hasPermission("manager", "result:revoke")).toBe(false);
    expect(hasPermission("system_admin", "result:revoke")).toBe(true);
  });
  it("only lets system administrators delete events", () => {
    expect(hasPermission("manager", "event:delete")).toBe(false);
    expect(hasPermission("system_admin", "event:delete")).toBe(true);
  });
  it("only lets system administrators manage staff accounts", () => {
    expect(hasPermission("manager", "staff:manage")).toBe(false);
    expect(hasPermission("system_admin", "staff:manage")).toBe(true);
  });
  it("uses dedicated concierge draft, publish, and private-answer permissions", () => {
    expect(hasPermission("operator", "concierge:manage")).toBe(false);
    expect(hasPermission("manager", "concierge:manage")).toBe(true);
    expect(hasPermission("manager", "concierge:publish")).toBe(true);
    expect(hasPermission("manager", "concierge:private-read")).toBe(false);
    expect(hasPermission("system_admin", "concierge:private-read")).toBe(true);
  });
  it("supports exact per-staff permission selections", () => {
    expect(hasPermission("reception", "event:write", ["event:write"])).toBe(true);
    expect(hasPermission("system_admin", "staff:manage", ["checkin:write"])).toBe(false);
    expect(permissionsForRole("operator")).toContain("application:import");
  });
  it("fails closed when stored permissions contain an unknown value", () => {
    expect(parsePermissions(["checkin:write", "unknown:permission"])).toEqual([]);
    expect(parsePermissions(null)).toBeNull();
  });
});
