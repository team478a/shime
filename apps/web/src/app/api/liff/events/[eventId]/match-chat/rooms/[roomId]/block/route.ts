import { participantHandler } from "@shime/web/server/api/participant-handler";
import { blockMatchChatRoom } from "@shime/web/server/match-chat-use-cases";
import { matchChatError, matchChatJson, matchChatScope } from "../../../route-utils";

const resolveEventId = async (_request: Request, context: { params: Promise<{ eventId: string; roomId: string }> }) =>
  (await context.params).eventId;

export const POST = participantHandler(resolveEventId, async (handlerContext, _request, routeContext) => {
  const { roomId } = await routeContext.params;
  const result = await blockMatchChatRoom.execute(matchChatScope(handlerContext), roomId);
  return result.ok ? matchChatJson({ data: result.data }) : matchChatError(result, handlerContext.requestId);
});
