import { z } from "zod";

export const notificationPayloadSchema = z
  .object({
    text: z.string().min(1),
  })
  .passthrough();

export const notificationDispatchSummarySchema = z
  .object({
    processed: z.number().int().min(0),
    sent: z.number().int().min(0),
    failed: z.number().int().min(0),
  })
  .strict();

export type NotificationDispatchSummary = z.infer<typeof notificationDispatchSummarySchema>;

export type NotificationJobItem = {
  id: string;
  tenantId: string;
  eventId: string;
  userId: string;
  payload: unknown;
  attemptCount: number;
};

export type NotificationClaim = {
  attemptCount: number;
};

export type NotificationAttempt = {
  id: string;
};

export type NotificationScope = {
  id: string;
  tenantId: string;
  eventId: string;
};
