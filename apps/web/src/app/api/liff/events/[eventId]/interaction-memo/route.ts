import { NextResponse } from "next/server";
import { participantHandler } from "@shime/web/server/api/participant-handler";
import { getInteractionMemoWorkspace } from "@shime/web/server/interaction-memo-use-cases";

const SERVICE_TYPE = "marriage";
const resolveEventId = async (_request: Request, context: { params: Promise<{ eventId: string }> }) =>
  (await context.params).eventId;
const json = (body: unknown, status = 200) => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

export const GET = participantHandler(resolveEventId, async ({ eventId, participant, requestId, session }) => {
  const result = await getInteractionMemoWorkspace.execute({
    tenantId: session.tenantId,
    eventId,
    serviceType: SERVICE_TYPE,
    participantId: participant.id,
  });
  return result.ok
    ? json({ data: result.data })
    : json({ code: result.code, message: "操作を完了できませんでした。", request_id: requestId }, result.status);
});
