import { z } from "zod";
import { participantHandler } from "@shime/web/server/api/participant-handler";
import { acceptMatchChatConsent } from "@shime/web/server/match-chat-use-cases";
import { matchChatError, matchChatJson, matchChatScope, roomData } from "../../../route-utils";

const inputSchema = z.object({ termsVersion: z.string().trim().min(1).max(80) }).strict();
const resolveEventId = async (_request: Request, context: { params: Promise<{ eventId: string; roomId: string }> }) =>
  (await context.params).eventId;

export const POST = participantHandler(resolveEventId, async (handlerContext, request: Request, routeContext) => {
  const { roomId } = await routeContext.params;
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success)
    return matchChatError({ ok: false, code: "MATCH_CHAT_INVALID_REQUEST", status: 400 }, handlerContext.requestId);
  const result = await acceptMatchChatConsent.execute(matchChatScope(handlerContext), roomId, input.data.termsVersion);
  return result.ok ? matchChatJson({ data: roomData(result.data) }) : matchChatError(result, handlerContext.requestId);
});
