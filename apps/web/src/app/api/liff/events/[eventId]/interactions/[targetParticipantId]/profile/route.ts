import { NextResponse } from "next/server";
import { z } from "zod";
import { participantHandler } from "@shime/web/server/api/participant-handler";
import { getInteractionPublicProfile } from "@shime/web/server/interaction-memo-use-cases";

const SERVICE_TYPE = "marriage";
const paramsSchema = z.object({ eventId: z.string().uuid(), targetParticipantId: z.string().uuid() });
const resolveEventId = async (
  _request: Request,
  context: { params: Promise<{ eventId: string; targetParticipantId: string }> },
) => (await context.params).eventId;
const json = (body: unknown, status = 200) => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

export const GET = participantHandler(
  resolveEventId,
  async ({ participant, requestId, session }, _request, context) => {
    const parsed = paramsSchema.safeParse(await context.params);
    if (!parsed.success)
      return json({ code: "INVALID_INPUT", message: "相手を確認できませんでした。", request_id: requestId }, 400);
    const result = await getInteractionPublicProfile.execute(
      {
        tenantId: session.tenantId,
        eventId: parsed.data.eventId,
        serviceType: SERVICE_TYPE,
        participantId: participant.id,
      },
      parsed.data.targetParticipantId,
    );
    return result.ok
      ? json({ data: result.data })
      : json({ code: result.code, message: "プロフィールを表示できません。", request_id: requestId }, result.status);
  },
);
