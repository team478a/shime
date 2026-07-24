import { describe, expect, it, vi } from "vitest";
import {
  DispatchNotifications,
  type NotificationDeliveryProvider,
  type NotificationJobItem,
  type NotificationRepository,
} from "@shime/notifications";

const now = new Date("2026-07-24T04:00:00.000Z");
const item: NotificationJobItem = {
  id: "notification-1",
  tenantId: "tenant-1",
  eventId: "event-1",
  userId: "user-1",
  payload: { text: "ご案内です" },
  attemptCount: 0,
};

function repository(overrides: Partial<NotificationRepository> = {}): NotificationRepository {
  return {
    listEnabledTenantIds: async () => ["tenant-1"],
    listDue: async () => [item],
    claim: async () => ({ attemptCount: 1 }),
    createAttempt: async () => ({ id: "attempt-1" }),
    findLineUserId: async () => "line-user-1",
    markSent: async () => undefined,
    markFailed: async () => undefined,
    recordScheduleRun: async () => undefined,
    ...overrides,
  };
}

const classifyFailure = (error: unknown) =>
  error instanceof Error &&
  (error.message === "LINE_IDENTITY_MISSING" || error.message === "INVALID_NOTIFICATION_PAYLOAD")
    ? error.message
    : "LINE_SEND_FAILED";

describe("DispatchNotifications", () => {
  it("claims, sends and records a queued notification within its tenant and event scope", async () => {
    const markSent = vi.fn(async () => undefined);
    const recordScheduleRun = vi.fn(async () => undefined);
    const deliveryProvider: NotificationDeliveryProvider = {
      sendText: vi.fn(async () => ({ messageId: "line-message-1" })),
    };
    const useCase = new DispatchNotifications(
      repository({ markSent, recordScheduleRun }),
      deliveryProvider,
      classifyFailure,
      () => now,
    );

    await expect(useCase.execute()).resolves.toEqual({ processed: 1, sent: 1, failed: 0 });
    expect(deliveryProvider.sendText).toHaveBeenCalledWith("tenant-1", "line-user-1", "ご案内です");
    expect(markSent).toHaveBeenCalledWith(
      { id: "notification-1", tenantId: "tenant-1", eventId: "event-1" },
      "attempt-1",
      "line-message-1",
      now,
    );
    expect(recordScheduleRun).toHaveBeenCalledWith(["tenant-1"], "success", { processed: 1, sent: 1, failed: 0 }, now);
  });

  it("records the safe missing-identity failure code without calling LINE", async () => {
    const markFailed = vi.fn(async () => undefined);
    const deliveryProvider: NotificationDeliveryProvider = {
      sendText: vi.fn(async () => ({ messageId: "unused" })),
    };
    const useCase = new DispatchNotifications(
      repository({ findLineUserId: async () => null, markFailed }),
      deliveryProvider,
      classifyFailure,
      () => now,
    );

    await expect(useCase.execute()).resolves.toEqual({ processed: 1, sent: 0, failed: 1 });
    expect(deliveryProvider.sendText).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith(
      { id: "notification-1", tenantId: "tenant-1", eventId: "event-1" },
      "attempt-1",
      "LINE_IDENTITY_MISSING",
      now,
    );
  });

  it("rejects an invalid payload at the Zod boundary", async () => {
    const markFailed = vi.fn(async () => undefined);
    const useCase = new DispatchNotifications(
      repository({
        listDue: async () => [{ ...item, payload: { text: "" } }],
        markFailed,
      }),
      { sendText: vi.fn(async () => ({})) },
      classifyFailure,
      () => now,
    );

    await expect(useCase.execute()).resolves.toEqual({ processed: 1, sent: 0, failed: 1 });
    expect(markFailed).toHaveBeenCalledWith(
      expect.objectContaining({ id: item.id, tenantId: item.tenantId, eventId: item.eventId }),
      "attempt-1",
      "INVALID_NOTIFICATION_PAYLOAD",
      now,
    );
  });

  it("does not process a notification claimed by another worker", async () => {
    const markSent = vi.fn(async () => undefined);
    const markFailed = vi.fn(async () => undefined);
    const recordScheduleRun = vi.fn(async () => undefined);
    const deliveryProvider: NotificationDeliveryProvider = {
      sendText: vi.fn(async () => ({})),
    };
    const useCase = new DispatchNotifications(
      repository({ claim: async () => null, markSent, markFailed, recordScheduleRun }),
      deliveryProvider,
      classifyFailure,
      () => now,
    );

    await expect(useCase.execute()).resolves.toEqual({ processed: 0, sent: 0, failed: 0 });
    expect(deliveryProvider.sendText).not.toHaveBeenCalled();
    expect(markSent).not.toHaveBeenCalled();
    expect(markFailed).not.toHaveBeenCalled();
    expect(recordScheduleRun).toHaveBeenCalledWith(["tenant-1"], "success", { processed: 0, sent: 0, failed: 0 }, now);
  });
});
