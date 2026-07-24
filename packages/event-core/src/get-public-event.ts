import type { PublicEventRepository } from "./public-event-repository";
import type { GetPublicEventResult } from "./public-event-types";

export class GetPublicEvent {
  constructor(private readonly repository: PublicEventRepository) {}

  async execute(eventId: string): Promise<GetPublicEventResult> {
    const event = await this.repository.findAcceptingById(eventId);
    if (!event) return { ok: false, code: "NOT_FOUND", status: 404 };

    const fields = await this.repository.listFormFields(event.tenantId, event.id);
    return {
      ok: true,
      data: {
        id: event.id,
        name: event.name,
        startsAt: event.startsAt,
        venueName: event.venueName,
        venueAddress: event.venueAddress,
        fields: [...fields].sort((left, right) => left.displayOrder - right.displayOrder),
      },
    };
  }
}
