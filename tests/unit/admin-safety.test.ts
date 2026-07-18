import { describe, expect, it } from "vitest";
import { eventDeletionBlocker, staffAccessChangeBlocker } from "@shime/core";

describe("event deletion safety", () => {
  it("allows only an empty confirmed draft", () => expect(eventDeletionBlocker({ status: "draft", confirmCode: "event-1", eventCode: "event-1", hasOperationalData: false })).toBeNull());
  it("blocks non-drafts, code mismatches and operational data", () => {
    expect(eventDeletionBlocker({ status: "accepting", confirmCode: "event-1", eventCode: "event-1", hasOperationalData: false })).toBe("ONLY_DRAFT_EVENT_CAN_BE_DELETED");
    expect(eventDeletionBlocker({ status: "draft", confirmCode: "wrong", eventCode: "event-1", hasOperationalData: false })).toBe("EVENT_CODE_MISMATCH");
    expect(eventDeletionBlocker({ status: "draft", confirmCode: "event-1", eventCode: "event-1", hasOperationalData: true })).toBe("EVENT_HAS_OPERATIONAL_DATA");
  });
});

describe("staff access safety", () => {
  it("blocks removing the actor's own system administrator access", () => expect(staffAccessChangeBlocker({ actorUserId: "a", targetUserId: "a", targetRole: "system_admin", nextRole: "manager", nextStatus: "active", activeSystemAdminCount: 2 })).toBe("CANNOT_REMOVE_OWN_ACCESS"));
  it("blocks disabling the last active system administrator", () => expect(staffAccessChangeBlocker({ actorUserId: "a", targetUserId: "b", targetRole: "system_admin", nextRole: "system_admin", nextStatus: "disabled", activeSystemAdminCount: 1 })).toBe("LAST_SYSTEM_ADMIN"));
  it("allows changing another administrator when a replacement remains", () => expect(staffAccessChangeBlocker({ actorUserId: "a", targetUserId: "b", targetRole: "system_admin", nextRole: "manager", nextStatus: "active", activeSystemAdminCount: 2 })).toBeNull());
});
