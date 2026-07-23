import { describe, expect, it } from "vitest";

import { getAdminPrimaryNavigation, getEventAdminNavigation, getEventAdminQuickActions } from "../../apps/web/src/lib/admin-navigation";

function eventKeys(role: "reception" | "operator" | "manager" | "system_admin") {
  return getEventAdminNavigation(role, "event/2026").flatMap((group) => group.items.map((item) => item.key));
}

describe("admin navigation", () => {
  it("shows system settings only to system administrators", () => {
    expect(getAdminPrimaryNavigation("manager").map((item) => item.key)).toEqual(["dashboard", "new-event", "venue-templates", "concierge"]);
    expect(getAdminPrimaryNavigation("system_admin").map((item) => item.key)).toEqual([
      "dashboard",
      "new-event",
      "venue-templates",
      "concierge",
      "staff",
      "platform",
    ]);
  });

  it("hides tenant-wide template management from event-scoped staff", () => {
    expect(getAdminPrimaryNavigation("manager", true).map((item) => item.key)).toEqual(["dashboard", "new-event"]);
  });

  it("limits reception staff to event-day check-in", () => {
    expect(eventKeys("reception")).toEqual(["checkin"]);
  });

  it("does not expose settings or private results to operators", () => {
    const keys = eventKeys("operator");
    expect(keys).toEqual(["imports", "analytics", "checkin", "seating", "exports"]);
    expect(keys).not.toContain("settings");
    expect(keys).not.toContain("results");
  });

  it("builds encoded event-scoped links for managers", () => {
    const groups = getEventAdminNavigation("manager", "event/2026");
    expect(groups.flatMap((group) => group.items).find((item) => item.key === "settings")?.href)
      .toBe("/admin/events/event%2F2026/settings");
    expect(eventKeys("manager")).toContain("results");
  });

  it("provides role-scoped smartphone quick actions", () => {
    expect(getEventAdminQuickActions("reception", "event/2026")).toEqual([
      expect.objectContaining({ key: "checkin", label: "受付", href: "/admin/events/event%2F2026/checkin" }),
    ]);
    expect(getEventAdminQuickActions("manager", "event/2026").map((item) => item.key)).toEqual([
      "participants",
      "checkin",
      "seating",
    ]);
  });
});
