import { z } from "zod";
import { PublishLineRichMenuError } from "@shime/integrations";
import { NextResponse } from "next/server";
import { AppError, BusinessRuleError } from "@shime/web/server/api/errors";
import { parseJsonBody, staffHandler } from "@shime/web/server/api/staff-handler";
import { createLineRichMenuUseCases } from "@shime/web/server/line-rich-menu-use-cases";

const publishInput = z.object({
  eventId: z.string().uuid(),
  confirmation: z.literal("APPLY_DEFAULT_RICH_MENU"),
});

const useCases = createLineRichMenuUseCases();

export const GET = staffHandler({ permission: "staff:manage" }, async ({ session }) => {
  return NextResponse.json({ data: await useCases.getState.execute(session.tenantId) });
});

export const POST = staffHandler({ permission: "staff:manage" }, async ({ requestId, session }, request: Request) => {
  const input = await parseJsonBody(request, publishInput);
  try {
    const deployment = await useCases.publish.execute({
      tenantId: session.tenantId,
      eventId: input.eventId,
      actorUserId: session.userId,
      requestId,
    });
    return NextResponse.json({ data: deployment });
  } catch (error) {
    if (!(error instanceof PublishLineRichMenuError)) throw error;
    if (["EVENT_NOT_FOUND", "LINE_DISABLED", "LIFF_NOT_CONFIGURED", "LINE_NOT_CONFIGURED"].includes(error.code)) {
      throw new BusinessRuleError(error.code);
    }
    throw new AppError(error.code, 502);
  }
});
