import { NextResponse } from "next/server";
import type { MatchChatResult, MatchChatRoom, MatchChatScope } from "@shime/match-chat";
import type { ParticipantHandlerContext } from "@shime/web/server/api/participant-handler";

export const SERVICE_TYPE = "marriage";

export function matchChatScope(context: ParticipantHandlerContext): MatchChatScope {
  return {
    tenantId: context.session.tenantId,
    eventId: context.eventId,
    serviceType: SERVICE_TYPE,
    participantId: context.participant.id,
  };
}

export function roomData(room: MatchChatRoom) {
  return {
    id: room.id,
    status: room.status,
    opensAt: room.opensAt?.toISOString() ?? null,
    closesAt: room.closesAt.toISOString(),
  };
}

export function matchChatJson(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function matchChatError(result: Extract<MatchChatResult<unknown>, { ok: false }>, requestId: string) {
  return matchChatJson(
    { code: result.code, message: "操作を完了できませんでした。", request_id: requestId },
    result.status,
  );
}
