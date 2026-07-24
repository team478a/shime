import type {
  NotificationAttempt,
  NotificationClaim,
  NotificationDispatchSummary,
  NotificationJobItem,
  NotificationScope,
} from "./types";

export interface NotificationRepository {
  listEnabledTenantIds(): Promise<string[]>;
  listDue(tenantIds: string[], dueAt: Date, limit: number): Promise<NotificationJobItem[]>;
  claim(item: NotificationJobItem, claimedAt: Date): Promise<NotificationClaim | null>;
  createAttempt(item: NotificationJobItem, attemptNumber: number, startedAt: Date): Promise<NotificationAttempt | null>;
  findLineUserId(tenantId: string, userId: string): Promise<string | null>;
  markSent(
    scope: NotificationScope,
    attemptId: string | null,
    providerMessageId: string | undefined,
    sentAt: Date,
  ): Promise<void>;
  markFailed(scope: NotificationScope, attemptId: string | null, errorCode: string, failedAt: Date): Promise<void>;
  recordScheduleRun(
    tenantIds: string[],
    status: "success" | "warning",
    summary: NotificationDispatchSummary,
    occurredAt: Date,
  ): Promise<void>;
}

export interface NotificationDeliveryProvider {
  sendText(tenantId: string, lineUserId: string, text: string): Promise<{ messageId?: string }>;
}
