import { NextResponse } from "next/server";
import { z } from "zod";
import { participantHandler } from "@shime/web/server/api/participant-handler";
import { cancelSelfReportedInteractionSlot } from "@shime/web/server/interaction-memo-use-cases";

const SERVICE_TYPE = "marriage";
const paramsSchema = z.object({ slotId: z.string().uuid(), targetParticipantId: z.string().uuid() });
const resolveEventId = async (
  _request: Request,
  context: { params: Promise<{ eventId: string; slotId: string; targetParticipantId: string }> },
) => (await context.params).eventId;
const json = (body: unknown, status = 200) => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

export const DELETE = participantHandler(
  resolveEventId,
  async ({ eventId, participant, requestId, session }, _request, context) => {
    const parsed = paramsSchema.safeParse(await context.params);
    if (!parsed.success)
      return json({ code: "INVALID_INPUT", message: "会話相手を選び直してください。", request_id: requestId }, 400);
    const result = await cancelSelfReportedInteractionSlot.execute(
      {
        tenantId: session.tenantId,
        eventId,
        serviceType: SERVICE_TYPE,
        participantId: participant.id,
        actorUserId: session.userId,
        requestId,
      },
      parsed.data.slotId,
      parsed.data.targetParticipantId,
    );
    return result.ok
      ? json({ data: result.data })
      : json(
          {
            code: result.code,
            message:
              result.code === "INTERACTION_TARGET_HAS_NOTE"
                ? "メモ入力後の会話相手は取り消せません。"
                : "会話相手を取り消せませんでした。",
            request_id: requestId,
          },
          result.status,
        );
  },
);
