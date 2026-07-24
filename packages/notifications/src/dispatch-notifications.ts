import type { NotificationDeliveryProvider, NotificationRepository } from "./repository";
import { notificationPayloadSchema } from "./types";
import type { NotificationDispatchSummary, NotificationJobItem, NotificationScope } from "./types";

type FailureClassifier = (error: unknown) => string;

export class DispatchNotifications {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly deliveryProvider: NotificationDeliveryProvider,
    private readonly classifyFailure: FailureClassifier,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<NotificationDispatchSummary> {
    const enabledTenantIds = await this.repository.listEnabledTenantIds();
    const queued = await this.repository.listDue(enabledTenantIds, this.now(), 20);
    let sent = 0;
    let failed = 0;

    for (const item of queued) {
      const claimed = await this.repository.claim(item, this.now());
      if (!claimed) continue;

      const attempt = await this.repository.createAttempt(item, claimed.attemptCount, this.now());
      try {
        const providerMessageId = await this.deliver(item);
        await this.repository.markSent(this.scope(item), attempt?.id ?? null, providerMessageId, this.now());
        sent += 1;
      } catch (error) {
        await this.repository.markFailed(
          this.scope(item),
          attempt?.id ?? null,
          this.classifyFailure(error),
          this.now(),
        );
        failed += 1;
      }
    }

    const summary = { processed: sent + failed, sent, failed };
    if (enabledTenantIds.length > 0) {
      await this.repository.recordScheduleRun(
        enabledTenantIds,
        failed > 0 ? "warning" : "success",
        summary,
        this.now(),
      );
    }
    return summary;
  }

  private async deliver(item: NotificationJobItem): Promise<string | undefined> {
    const lineUserId = await this.repository.findLineUserId(item.tenantId, item.userId);
    if (!lineUserId) throw new Error("LINE_IDENTITY_MISSING");

    const payload = notificationPayloadSchema.safeParse(item.payload);
    if (!payload.success) throw new Error("INVALID_NOTIFICATION_PAYLOAD");

    const result = await this.deliveryProvider.sendText(item.tenantId, lineUserId, payload.data.text);
    return result.messageId;
  }

  private scope(item: NotificationJobItem): NotificationScope {
    return { id: item.id, tenantId: item.tenantId, eventId: item.eventId };
  }
}
