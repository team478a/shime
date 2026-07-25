import { NextResponse } from "next/server";

import { participantHandler } from "@shime/web/server/api/participant-handler";
import { getDiagnosisCardObjectKey } from "@shime/web/server/concierge-diagnosis-use-cases";
import { createConciergeStorageProvider } from "@shime/web/server/concierge-storage";

type Context = { params: Promise<{ eventId: string; cardVersionId: string }> };

export const GET = participantHandler(
  async (_request: Request, context: Context) => (await context.params).eventId,
  async ({ eventId, requestId, session }, _request, context) => {
    const { cardVersionId } = await context.params;
    const objectKey = await getDiagnosisCardObjectKey.execute(
      { tenantId: session.tenantId, eventId },
      cardVersionId,
    );
    if (!objectKey) return NextResponse.json({ code: "NOT_FOUND", request_id: requestId }, { status: 404 });
    const url = await createConciergeStorageProvider().createSignedReadUrl(objectKey, 300);
    return NextResponse.redirect(url, {
      status: 307,
      headers: { "cache-control": "private, no-store" },
    });
  },
);
