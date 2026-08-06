import { createInteractionMemoDraftSchema, InteractionMemoAdminError } from "@shime/interactions";
import { NextResponse } from "next/server";
import { interactionMemoAdmin } from "@shime/web/server/interaction-memo-admin";
import { parseJsonBody, staffEventHandler } from "@shime/web/server/api/staff-handler";

const resolveEventId = async (_request: Request, context: { params: Promise<{ eventId: string }> }) =>
  (await context.params).eventId;

function errorResponse(error: unknown, requestId: string) {
  if (!(error instanceof InteractionMemoAdminError)) throw error;
  const status = error.code === "EVENT_NOT_FOUND" ? 404 : 400;
  return NextResponse.json({ code: error.code, request_id: requestId }, { status });
}

export const GET = staffEventHandler(
  { permission: "event:write" },
  resolveEventId,
  async ({ eventId, requestId, session }) => {
    try {
      const data = await interactionMemoAdmin.list.execute({
        tenantId: session.tenantId,
        eventId,
        serviceType: "marriage",
        actorUserId: session.userId,
        requestId,
      });
      return NextResponse.json({ data });
    } catch (error) {
      return errorResponse(error, requestId);
    }
  },
);

export const POST = staffEventHandler(
  { permission: "event:write" },
  resolveEventId,
  async ({ eventId, requestId, session }, request) => {
    try {
      const input = await parseJsonBody(request, createInteractionMemoDraftSchema);
      const data = await interactionMemoAdmin.createDraft.execute(
        {
          tenantId: session.tenantId,
          eventId,
          serviceType: "marriage",
          actorUserId: session.userId,
          requestId,
        },
        input,
      );
      return NextResponse.json({ data }, { status: 201 });
    } catch (error) {
      return errorResponse(error, requestId);
    }
  },
);
