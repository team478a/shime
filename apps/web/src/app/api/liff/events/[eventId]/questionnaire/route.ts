import { NextResponse } from "next/server";
import { z } from "zod";
import { participantHandler } from "@shime/web/server/api/participant-handler";
import { getQuestionnaire, saveQuestionnaireDraft } from "@shime/web/server/questionnaire-use-cases";

const bodySchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      optionCodes: z.array(z.string()).default([]),
      declined: z.boolean().default(false),
    }),
  ),
});

const resolveEventId = async (_request: Request, context: { params: Promise<{ eventId: string }> }) =>
  (await context.params).eventId;

export const GET = participantHandler(resolveEventId, async ({ eventId, participant, session }) => {
  const result = await getQuestionnaire.execute({
    tenantId: session.tenantId,
    eventId,
    participantId: participant.id,
  });
  return result.ok
    ? NextResponse.json({ data: result.data })
    : NextResponse.json({ code: result.code }, { status: result.status });
});

export const PUT = participantHandler(resolveEventId, async ({ eventId, participant, session }, request: Request) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  const result = await saveQuestionnaireDraft.execute(
    { tenantId: session.tenantId, eventId, participantId: participant.id },
    parsed.data.answers,
  );
  return result.ok
    ? NextResponse.json({ data: result.data })
    : NextResponse.json({ code: result.code }, { status: result.status });
});
