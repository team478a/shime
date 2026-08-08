import { NextResponse } from "next/server";
import { z } from "zod";
import { participantHandler } from "@shime/web/server/api/participant-handler";
import { createSelfReportedInteractionSlot } from "@shime/web/server/interaction-memo-use-cases";

const SERVICE_TYPE = "marriage";
const bodySchema = z.object({ targetParticipantId: z.string().uuid() }).strict();
const resolveEventId = async (_request: Request, context: { params: Promise<{ eventId: string }> }) =>
  (await context.params).eventId;
const json = (body: unknown, status = 200) => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

export const POST = participantHandler(
  resolveEventId,
  async ({ eventId, participant, requestId, session }, request) => {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return json({ code: "INVALID_INPUT", message: "候補を選び直してください。", request_id: requestId }, 400);
    const result = await createSelfReportedInteractionSlot.execute(
      {
        tenantId: session.tenantId,
        eventId,
        serviceType: SERVICE_TYPE,
        participantId: participant.id,
        actorUserId: session.userId,
        requestId,
      },
      parsed.data.targetParticipantId,
    );
    return result.ok
      ? json({ data: result.data })
      : json({ code: result.code, message: "会話相手を追加できませんでした。", request_id: requestId }, result.status);
  },
);
