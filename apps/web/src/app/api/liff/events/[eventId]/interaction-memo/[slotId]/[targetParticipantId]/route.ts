import { NextResponse } from "next/server";
import { z } from "zod";
import { interactionFeelingCodeSchema } from "@shime/interactions";
import { participantHandler } from "@shime/web/server/api/participant-handler";
import { saveInteractionMemo } from "@shime/web/server/interaction-memo-use-cases";

const SERVICE_TYPE = "marriage";
const bodySchema = z
  .object({
    feelingCode: interactionFeelingCodeSchema,
    favorite: z.boolean(),
    privateNoteText: z
      .string()
      .max(120)
      .refine((value) => value.split(/\r?\n/).length <= 3, "メモは3行以内です")
      .default(""),
    wantsToTalkMore: z.boolean().default(false),
    expectedRevision: z.number().int().min(0),
  })
  .strict();
const resolveEventId = async (
  _request: Request,
  context: { params: Promise<{ eventId: string; slotId: string; targetParticipantId: string }> },
) => (await context.params).eventId;
const json = (body: unknown, status = 200) => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

export const PUT = participantHandler(
  resolveEventId,
  async ({ eventId, participant, requestId, session }, request, context) => {
    const [params, body] = await Promise.all([context.params, request.json().catch(() => null)]);
    const parsed = bodySchema.safeParse(body);
    const routeParams = z
      .object({ slotId: z.string().uuid(), targetParticipantId: z.string().uuid() })
      .safeParse(params);
    if (!parsed.success || !routeParams.success)
      return json({ code: "INVALID_INPUT", message: "入力内容を確認してください。", request_id: requestId }, 400);

    const result = await saveInteractionMemo.execute(
      {
        tenantId: session.tenantId,
        eventId,
        serviceType: SERVICE_TYPE,
        participantId: participant.id,
        actorUserId: session.userId,
        requestId,
      },
      {
        ...parsed.data,
        interactionSlotId: routeParams.data.slotId,
        targetParticipantId: routeParams.data.targetParticipantId,
      },
    );
    return result.ok
      ? json({ data: result.data })
      : json({ code: result.code, message: "操作を完了できませんでした。", request_id: requestId }, result.status);
  },
);
