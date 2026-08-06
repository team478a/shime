import { NextResponse } from "next/server";
import { z } from "zod";
import { participantHandler } from "@shime/web/server/api/participant-handler";
import { searchSelfReportedInteractionTargets } from "@shime/web/server/interaction-memo-use-cases";

const SERVICE_TYPE = "marriage";
const querySchema = z.string().trim().min(1).max(20);
const resolveEventId = async (_request: Request, context: { params: Promise<{ eventId: string }> }) =>
  (await context.params).eventId;
const json = (body: unknown, status = 200) => {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
};

export const GET = participantHandler(resolveEventId, async ({ eventId, participant, requestId, session }, request) => {
  const parsed = querySchema.safeParse(new URL(request.url).searchParams.get("q"));
  if (!parsed.success)
    return json(
      { code: "INVALID_INPUT", message: "参加者番号を1文字以上入力してください。", request_id: requestId },
      400,
    );
  const result = await searchSelfReportedInteractionTargets.execute(
    {
      tenantId: session.tenantId,
      eventId,
      serviceType: SERVICE_TYPE,
      participantId: participant.id,
    },
    parsed.data,
  );
  return result.ok
    ? json({ data: result.data })
    : json({ code: result.code, message: "候補を確認できませんでした。", request_id: requestId }, result.status);
});
