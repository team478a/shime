import { MatchChatAdminError, matchChatConfigSchema } from "@shime/match-chat";
import { NextResponse } from "next/server";
import { parseJsonBody, staffEventHandler } from "@shime/web/server/api/staff-handler";
import { matchChatAdmin } from "@shime/web/server/match-chat-admin";

const resolveEventId = async (_request: Request, context: { params: Promise<{ eventId: string }> }) =>
  (await context.params).eventId;

function scope(eventId: string, session: { tenantId: string; userId: string }, requestId: string) {
  return {
    tenantId: session.tenantId,
    eventId,
    serviceType: "marriage",
    actorUserId: session.userId,
    requestId,
  };
}

function errorResponse(error: unknown, requestId: string) {
  if (!(error instanceof MatchChatAdminError)) throw error;
  const status = error.code === "EVENT_NOT_FOUND" ? 404 : 400;
  return NextResponse.json({ code: error.code, request_id: requestId }, { status });
}

export const GET = staffEventHandler(
  { permission: "event:write" },
  resolveEventId,
  async ({ eventId, requestId, session }) => {
    try {
      const data = await matchChatAdmin.getWorkspace.execute(scope(eventId, session, requestId));
      return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return errorResponse(error, requestId);
    }
  },
);

export const PUT = staffEventHandler(
  { permission: "event:write" },
  resolveEventId,
  async ({ eventId, requestId, session }, request) => {
    try {
      const input = await parseJsonBody(request, matchChatConfigSchema, "INVALID_MATCH_CHAT_CONFIG");
      const data = await matchChatAdmin.saveConfig.execute(scope(eventId, session, requestId), input);
      return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return errorResponse(error, requestId);
    }
  },
);
