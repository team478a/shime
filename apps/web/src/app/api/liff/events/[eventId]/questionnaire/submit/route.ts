import { NextResponse } from "next/server";
import { participantHandler } from "@shime/web/server/api/participant-handler";
import { submitQuestionnaire } from "@shime/web/server/questionnaire-use-cases";

export const POST = participantHandler(
  async (_request: Request, context: { params: Promise<{ eventId: string }> }) => (await context.params).eventId,
  async ({ eventId, participant, session }) => {
    const result = await submitQuestionnaire.execute(
      { tenantId: session.tenantId, eventId, participantId: participant.id },
      participant.dreamState,
    );
    return result.ok
      ? NextResponse.json({ data: result.data })
      : NextResponse.json({ code: result.code }, { status: result.status });
  },
);
