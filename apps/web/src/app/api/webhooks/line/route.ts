import { NextResponse } from "next/server";
import { webhookHandler } from "@shime/web/server/api/webhook-handler";
import { processLineWebhook } from "@shime/web/server/line-webhook-use-case";

export const POST = webhookHandler(async ({ rawBody, signature, tenantCode }) => {
  const result = await processLineWebhook.execute({
    tenantCode,
    rawBody,
    signature,
  });
  return result.ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ code: result.code }, { status: result.status });
});
