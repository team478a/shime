import { NextResponse } from "next/server";

import { publicEventHandler } from "@shime/web/server/api/public-handler";
import { getPublicEvent } from "@shime/web/server/public-event-use-case";

export const GET = publicEventHandler(
  { includeRequestIdInErrors: false },
  async (_request, context: { params: Promise<{ eventId: string }> }) =>
    (await context.params).eventId,
  async ({ eventId }) => {
    const result = await getPublicEvent.execute(eventId);

    return result.ok
      ? NextResponse.json({ data: result.data })
      : NextResponse.json({ code: result.code }, { status: result.status });
  },
);
