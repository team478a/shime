import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, staffEventHandler } from "@shime/web/server/api/staff-handler";
import {
  getDiagnosisStatusSummary,
  updateDiagnosisEventSettings,
} from "@shime/web/server/concierge-diagnosis-use-cases";

type Context = { params: Promise<{ eventId: string }> };

const settingsSchema = z.object({
  enabled: z.boolean(),
  accessOpensAt: z.string().datetime({ offset: true }).nullable(),
  accessClosesAt: z.string().datetime({ offset: true }).nullable(),
  allowResubmission: z.boolean(),
});

const resolveEventId = async (_request: Request, context: Context) => (await context.params).eventId;

export const GET = staffEventHandler(
  { permission: "concierge:manage" },
  resolveEventId,
  async ({ eventId, requestId, session }) => {
    const summary = await getDiagnosisStatusSummary.execute({ tenantId: session.tenantId, eventId });
    return summary
      ? NextResponse.json({ data: summary })
      : NextResponse.json({ code: "NOT_FOUND", request_id: requestId }, { status: 404 });
  },
);

export const PATCH = staffEventHandler(
  { permission: "concierge:publish" },
  resolveEventId,
  async ({ eventId, requestId, session }, request) => {
    const input = await parseJsonBody(request, settingsSchema);
    const result = await updateDiagnosisEventSettings.execute({
      tenantId: session.tenantId,
      eventId,
      actorUserId: session.userId,
      requestId,
      enabled: input.enabled,
      accessOpensAt: input.accessOpensAt ? new Date(input.accessOpensAt) : null,
      accessClosesAt: input.accessClosesAt ? new Date(input.accessClosesAt) : null,
      allowResubmission: input.allowResubmission,
      now: new Date(),
    });
    return result.ok
      ? NextResponse.json({ data: result.data })
      : NextResponse.json({ code: result.code, request_id: requestId }, { status: result.status });
  },
);
