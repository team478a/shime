import { InteractionMemoAdminError } from "@shime/interactions";
import { NextResponse } from "next/server";
import { interactionMemoAdmin } from "@shime/web/server/interaction-memo-admin";
import { staffEventHandler } from "@shime/web/server/api/staff-handler";

type Context = { params: Promise<{ eventId: string; snapshotId: string }> };
const resolveEventId = async (_request: Request, context: Context) => (await context.params).eventId;

export const POST = staffEventHandler(
  { permission: "concierge:publish" },
  resolveEventId,
  async ({ eventId, requestId, session }, _request, context: Context) => {
    try {
      const { snapshotId } = await context.params;
      const data = await interactionMemoAdmin.stop.execute(
        {
          tenantId: session.tenantId,
          eventId,
          serviceType: "marriage",
          actorUserId: session.userId,
          requestId,
        },
        snapshotId,
      );
      return NextResponse.json({ data });
    } catch (error) {
      if (!(error instanceof InteractionMemoAdminError)) throw error;
      const status = error.code === "SNAPSHOT_NOT_FOUND" ? 404 : 409;
      return NextResponse.json({ code: error.code, request_id: requestId }, { status });
    }
  },
);
