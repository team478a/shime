import { MatchChatAdminError, updateMatchChatReportSchema } from "@shime/match-chat";
import { NextResponse } from "next/server";
import { parseJsonBody, staffEventHandler } from "@shime/web/server/api/staff-handler";
import { matchChatAdmin } from "@shime/web/server/match-chat-admin";

type Context = { params: Promise<{ eventId: string; reportId: string }> };
const resolveEventId = async (_request: Request, context: Context) => (await context.params).eventId;

export const PATCH = staffEventHandler(
  { permission: "event:write" },
  resolveEventId,
  async ({ eventId, requestId, session }, request, context: Context) => {
    try {
      const { reportId } = await context.params;
      const input = await parseJsonBody(request, updateMatchChatReportSchema, "MATCH_CHAT_REPORT_INVALID_STATE");
      const data = await matchChatAdmin.updateReport.execute(
        {
          tenantId: session.tenantId,
          eventId,
          serviceType: "marriage",
          actorUserId: session.userId,
          requestId,
        },
        reportId,
        input,
      );
      return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (!(error instanceof MatchChatAdminError)) throw error;
      const status = error.code === "MATCH_CHAT_REPORT_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ code: error.code, request_id: requestId }, { status });
    }
  },
);
