import { z } from "zod";

export const lineWebhookBodySchema = z.object({
  events: z.array(
    z
      .object({
        webhookEventId: z.string().min(1),
        type: z.string().min(1),
        timestamp: z.number().optional(),
        source: z.object({ userId: z.string().optional() }).optional(),
      })
      .passthrough(),
  ),
});

export type LineWebhookEvent = z.infer<typeof lineWebhookBodySchema>["events"][number];

export type StoredLineWebhookEvent = {
  webhookEventId: string;
  eventType: string;
  lineUserIdHash: string | null;
  occurredAt: Date | null;
  processedAt: Date;
};

export type ProcessLineWebhookResult =
  | { ok: true }
  | {
      ok: false;
      code: "TENANT_NOT_FOUND" | "LINE_NOT_CONFIGURED" | "INVALID_SIGNATURE" | "INVALID_BODY";
      status: 400 | 401 | 404 | 503;
    };
