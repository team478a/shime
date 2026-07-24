import { and, eq } from "drizzle-orm";
import { eventFormFields, events, getDatabase } from "@shime/db";
import type { PublicEventRepository } from "./public-event-repository";
import { publicEventFieldValidationSchema } from "./public-event-types";

export function createDrizzlePublicEventRepository(): PublicEventRepository {
  return {
    async findAcceptingById(eventId) {
      return (
        (
          await getDatabase()
            .select({
              id: events.id,
              tenantId: events.tenantId,
              name: events.name,
              startsAt: events.startsAt,
              venueName: events.venueName,
              venueAddress: events.venueAddress,
            })
            .from(events)
            .where(and(eq(events.id, eventId), eq(events.status, "accepting")))
            .limit(1)
        )[0] ?? null
      );
    },

    async listFormFields(tenantId, eventId) {
      const fields = await getDatabase()
        .select()
        .from(eventFormFields)
        .where(and(eq(eventFormFields.tenantId, tenantId), eq(eventFormFields.eventId, eventId)));
      return fields.map((field) => ({
        ...field,
        validation: publicEventFieldValidationSchema.parse(field.validation),
      }));
    },
  };
}
