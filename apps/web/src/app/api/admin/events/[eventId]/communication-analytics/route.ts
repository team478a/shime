import { OperationsAnalyticsError } from "@shime/operations-analytics";
import { NextResponse } from "next/server";
import { staffEventHandler } from "@shime/web/server/api/staff-handler";
import { operationsAnalytics } from "@shime/web/server/operations-analytics";

const resolveEventId = async (_request: Request, context: { params: Promise<{ eventId: string }> }) =>
  (await context.params).eventId;

export const GET = staffEventHandler(
  { permission: "operations:read" },
  resolveEventId,
  async ({ eventId, requestId, session }) => {
    try {
      const data = await operationsAnalytics.execute({
        tenantId: session.tenantId,
        eventId,
        serviceType: "marriage",
      });
      return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (!(error instanceof OperationsAnalyticsError)) throw error;
      return NextResponse.json({ code: error.code, request_id: requestId }, { status: 404 });
    }
  },
);
