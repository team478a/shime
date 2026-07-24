import { describe, expect, it, vi } from "vitest";

import { GetPublicEvent, type PublicEventFormField, type PublicEventRepository } from "@shime/event-core";

const now = new Date("2026-07-24T00:00:00.000Z");
const event = {
  id: "event-1",
  tenantId: "tenant-1",
  name: "SHIME Event",
  startsAt: new Date("2026-08-08T04:00:00.000Z"),
  venueName: "Venue",
  venueAddress: "Tokyo",
};

function field(id: string, displayOrder: number): PublicEventFormField {
  return {
    id,
    tenantId: event.tenantId,
    eventId: event.id,
    fieldKey: `field_${id}`,
    label: `Field ${id}`,
    type: "text",
    requirement: "required",
    displayOrder,
    validation: { maxLength: 100 },
    createdAt: now,
    updatedAt: now,
  };
}

describe("GetPublicEvent", () => {
  it("preserves the not-found contract when an event is not accepting", async () => {
    const listFormFields = vi.fn();
    const repository: PublicEventRepository = {
      findAcceptingById: async () => null,
      listFormFields,
    };

    await expect(new GetPublicEvent(repository).execute(event.id)).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      status: 404,
    });
    expect(listFormFields).not.toHaveBeenCalled();
  });

  it("loads fields within the event tenant and preserves the public response", async () => {
    const later = field("later", 2);
    const earlier = field("earlier", 1);
    const listFormFields = vi.fn(async () => [later, earlier]);
    const repository: PublicEventRepository = {
      findAcceptingById: async () => event,
      listFormFields,
    };

    await expect(new GetPublicEvent(repository).execute(event.id)).resolves.toEqual({
      ok: true,
      data: {
        id: event.id,
        name: event.name,
        startsAt: event.startsAt,
        venueName: event.venueName,
        venueAddress: event.venueAddress,
        fields: [earlier, later],
      },
    });
    expect(listFormFields).toHaveBeenCalledWith(event.tenantId, event.id);
  });
});
