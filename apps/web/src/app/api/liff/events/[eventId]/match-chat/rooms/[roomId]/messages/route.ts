import { sendMatchChatMessageSchema } from "@shime/match-chat";
import { participantHandler } from "@shime/web/server/api/participant-handler";
import { listMatchChatMessages, sendMatchChatMessage } from "@shime/web/server/match-chat-use-cases";
import { matchChatError, matchChatJson, matchChatScope } from "../../../route-utils";

const resolveEventId = async (_request: Request, context: { params: Promise<{ eventId: string; roomId: string }> }) =>
  (await context.params).eventId;

export const GET = participantHandler(resolveEventId, async (handlerContext, _request, routeContext) => {
  const { roomId } = await routeContext.params;
  const result = await listMatchChatMessages.execute(matchChatScope(handlerContext), roomId);
  return result.ok
    ? matchChatJson({ data: { messages: result.data } })
    : matchChatError(result, handlerContext.requestId);
});

export const POST = participantHandler(resolveEventId, async (handlerContext, request: Request, routeContext) => {
  const { roomId } = await routeContext.params;
  const input = sendMatchChatMessageSchema.strict().safeParse(await request.json().catch(() => null));
  if (!input.success)
    return matchChatError({ ok: false, code: "MATCH_CHAT_INVALID_MESSAGE", status: 400 }, handlerContext.requestId);
  const result = await sendMatchChatMessage.execute(matchChatScope(handlerContext), roomId, input.data);
  return result.ok ? matchChatJson({ data: result.data }) : matchChatError(result, handlerContext.requestId);
});
