import { z } from "zod";
import { participantHandler } from "@shime/web/server/api/participant-handler";
import { ensureMatchChatRoom } from "@shime/web/server/match-chat-use-cases";
import { matchChatError, matchChatJson, matchChatScope, roomData } from "../route-utils";

const inputSchema = z.object({ matchCandidateId: z.string().uuid() }).strict();
const resolveEventId = async (_request: Request, context: { params: Promise<{ eventId: string }> }) =>
  (await context.params).eventId;

export const POST = participantHandler(resolveEventId, async (handlerContext, request: Request) => {
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success)
    return matchChatError({ ok: false, code: "MATCH_CHAT_INVALID_REQUEST", status: 400 }, handlerContext.requestId);
  const result = await ensureMatchChatRoom.execute(matchChatScope(handlerContext), input.data.matchCandidateId);
  return result.ok
    ? matchChatJson({
        data: {
          ...roomData(result.data.room),
          termsVersion: result.data.termsVersion,
          maxMessageLength: result.data.maxMessageLength,
          participantConsented: result.data.participantConsented,
        },
      })
    : matchChatError(result, handlerContext.requestId);
});
