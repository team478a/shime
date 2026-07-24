import type { PublicEventFormField, PublicEventRecord } from "./public-event-types";

export interface PublicEventRepository {
  findAcceptingById(eventId: string): Promise<PublicEventRecord | null>;
  listFormFields(tenantId: string, eventId: string): Promise<PublicEventFormField[]>;
}
