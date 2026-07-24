import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, staffEventHandler } from "@shime/web/server/api/staff-handler";
import { confirmCheckin } from "@shime/web/server/checkin-use-cases";

const input = z.object({
  participantId: z.string().uuid(),
  method: z.enum(["qr", "manual"]),
});

export const POST = staffEventHandler(
  { permission: "checkin:write", includeRequestIdInErrors: false },
  async (_request: Request, { params }: { params: Promise<{ eventId: string }> }) => (await params).eventId,
  async ({ eventId, requestId, session }, request: Request) => {
    const data = await parseJsonBody(request, input);
    const result = await confirmCheckin.execute({
      tenantId: session.tenantId,
      eventId,
      participantId: data.participantId,
      actorUserId: session.userId,
      method: data.method,
      requestId,
      now: new Date(),
    });

    if (result.ok) return NextResponse.json({ data: result.data });
    return result.code === "ALREADY_CHECKED_IN"
      ? NextResponse.json({ code: result.code, data: result.data }, { status: result.status })
      : NextResponse.json({ code: result.code }, { status: result.status });
  },
);
