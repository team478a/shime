import { NextResponse } from "next/server";
import { z } from "zod";

import { participantHandler } from "@shime/web/server/api/participant-handler";
import { submitDiagnosis } from "@shime/web/server/concierge-diagnosis-use-cases";

const bodySchema = z.object({ expectedRevision: z.number().int().nonnegative() });

export const POST = participantHandler(
  async (_request: Request, context: { params: Promise<{ eventId: string }> }) => (await context.params).eventId,
  async ({ eventId, participant, requestId, session }, request) => {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", request_id: requestId }, { status: 400 });
    const result = await submitDiagnosis.execute(
      {
        tenantId: session.tenantId,
        eventId,
        participantId: participant.id,
        userId: session.userId,
      },
      parsed.data,
    );
    return result.ok
      ? NextResponse.json({ data: result.data })
      : NextResponse.json({ code: result.code, request_id: requestId }, { status: result.status });
  },
);
