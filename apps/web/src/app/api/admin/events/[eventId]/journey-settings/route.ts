import { NextResponse } from "next/server";

import { participantJourneyStepsSchema } from "@shime/event-core";
import { parseJsonBody, staffEventHandler } from "@shime/web/server/api/staff-handler";
import {
  getParticipantJourneySettings,
  publishParticipantJourneyDraft,
  saveParticipantJourneyDraft,
} from "@shime/web/server/event-journey-use-cases";

type Context = { params: Promise<{ eventId: string }> };

const resolveEventId = async (_request: Request, context: Context) => (await context.params).eventId;

export const GET = staffEventHandler({ permission: "event:write" }, resolveEventId, async ({ eventId, session }) => {
  const settings = await getParticipantJourneySettings.execute({
    tenantId: session.tenantId,
    eventId,
  });
  return settings ? NextResponse.json({ data: settings }) : NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
});

export const PUT = staffEventHandler(
  { permission: "event:write" },
  resolveEventId,
  async ({ eventId, requestId, session }, request) => {
    const steps = await parseJsonBody(request, participantJourneyStepsSchema);
    const draft = await saveParticipantJourneyDraft.execute({
      tenantId: session.tenantId,
      eventId,
      actorUserId: session.userId,
      requestId,
      steps,
      now: new Date(),
    });
    return draft
      ? NextResponse.json({ data: draft })
      : NextResponse.json({ code: "NOT_FOUND", request_id: requestId }, { status: 404 });
  },
);

export const POST = staffEventHandler(
  { permission: "event:write" },
  resolveEventId,
  async ({ eventId, requestId, session }) => {
    const published = await publishParticipantJourneyDraft.execute({
      tenantId: session.tenantId,
      eventId,
      actorUserId: session.userId,
      requestId,
      now: new Date(),
    });
    return published
      ? NextResponse.json({ data: published })
      : NextResponse.json({ code: "JOURNEY_DRAFT_NOT_FOUND", request_id: requestId }, { status: 404 });
  },
);
