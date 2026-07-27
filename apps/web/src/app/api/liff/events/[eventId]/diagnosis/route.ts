import { NextResponse } from "next/server";
import { z } from "zod";

import { participantHandler } from "@shime/web/server/api/participant-handler";
import { getDiagnosis, saveDiagnosisDraft } from "@shime/web/server/concierge-diagnosis-use-cases";

type Context = { params: Promise<{ eventId: string }> };

const bodySchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  selectedCardAssetVersionId: z.string().uuid(),
  answers: z.array(
    z.object({
      axisCode: z
        .string()
        .trim()
        .regex(/^[a-z0-9_]{2,40}$/),
      optionCode: z
        .string()
        .trim()
        .regex(/^[a-z0-9_]{1,80}$/),
    }),
  ),
});

const resolveEventId = async (_request: Request, context: Context) => (await context.params).eventId;

function errorResponse(result: { code: string; status: number }, requestId: string) {
  return NextResponse.json({ code: result.code, request_id: requestId }, { status: result.status });
}

export const GET = participantHandler(resolveEventId, async ({ eventId, participant, requestId, session }) => {
  const result = await getDiagnosis.execute({
    tenantId: session.tenantId,
    eventId,
    participantId: participant.id,
    userId: session.userId,
  });
  if (!result.ok) return errorResponse(result, requestId);
  const { diagnosis, ...state } = result.data;
  const selectedCard = diagnosis.cards.find((card) => card.id === state.session?.selectedCardAssetVersionId);
  const imageUrl = selectedCard
    ? `/api/liff/events/${encodeURIComponent(eventId)}/diagnosis/cards/${encodeURIComponent(selectedCard.id)}/image`
    : null;
  return NextResponse.json(
    {
      data: {
        ...state,
        diagnosis: {
          copy: diagnosis.copy,
          reportCopy: diagnosis.reportCopy,
          questions: diagnosis.questions,
          cards: diagnosis.cards.map((card) => ({ id: card.id, displayOrder: card.displayOrder })),
          selectedCard: selectedCard
            ? {
                id: selectedCard.id,
                title: selectedCard.title,
                message: selectedCard.message,
                altText: selectedCard.altText,
                displayOrder: selectedCard.displayOrder,
                imageUrl,
              }
            : null,
        },
      },
    },
    { headers: { "cache-control": "private, no-store" } },
  );
});

export const PUT = participantHandler(resolveEventId, async ({ eventId, participant, requestId, session }, request) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", request_id: requestId }, { status: 400 });
  const result = await saveDiagnosisDraft.execute(
    {
      tenantId: session.tenantId,
      eventId,
      participantId: participant.id,
      userId: session.userId,
    },
    parsed.data,
  );
  return result.ok ? NextResponse.json({ data: result.data }) : errorResponse(result, requestId);
});
