import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, staffEventHandler } from "@shime/web/server/api/staff-handler";
import { assignParticipantNumber } from "@shime/web/server/checkin-use-cases";

const input = z.object({ participantNumber: z.string().trim().min(1).max(40) });

export const PUT = staffEventHandler(
  { permission: "event:write" },
  async (_request: Request, { params }: { params: Promise<{ eventId: string; participantId: string }> }) =>
    (await params).eventId,
  async ({ eventId, requestId, session }, request: Request, { params }) => {
    const { participantId } = await params;
    const data = await parseJsonBody(request, input);
    const result = await assignParticipantNumber.execute({
      tenantId: session.tenantId,
      eventId,
      participantId,
      participantNumber: data.participantNumber,
      actorUserId: session.userId,
      requestId,
      now: new Date(),
    });

    if (result.ok) return NextResponse.json({ data: result.data });
    return NextResponse.json({ code: result.code, request_id: requestId }, { status: result.status });
  },
);
