import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { getDatabase, jobSchedules, notificationAttempts, notifications, userIdentities } from "@shime/db";
import type { NotificationRepository } from "./repository";
import { notificationDispatchSummarySchema } from "./types";

export function createDrizzleNotificationRepository(): NotificationRepository {
  return {
    async listEnabledTenantIds() {
      const schedules = await getDatabase()
        .select({ tenantId: jobSchedules.tenantId })
        .from(jobSchedules)
        .where(and(eq(jobSchedules.jobKey, "notification_dispatch"), eq(jobSchedules.enabled, true)));
      return schedules.map((schedule) => schedule.tenantId);
    },

    listDue(tenantIds, dueAt, limit) {
      if (tenantIds.length === 0) return Promise.resolve([]);
      return getDatabase()
        .select({
          id: notifications.id,
          tenantId: notifications.tenantId,
          eventId: notifications.eventId,
          userId: notifications.userId,
          payload: notifications.payload,
          attemptCount: notifications.attemptCount,
        })
        .from(notifications)
        .where(
          and(
            eq(notifications.status, "queued"),
            lte(notifications.scheduledAt, dueAt),
            inArray(notifications.tenantId, tenantIds),
          ),
        )
        .orderBy(asc(notifications.scheduledAt))
        .limit(limit);
    },

    async claim(item, claimedAt) {
      return (
        (
          await getDatabase()
            .update(notifications)
            .set({
              status: "sending",
              attemptCount: item.attemptCount + 1,
              updatedAt: claimedAt,
            })
            .where(
              and(
                eq(notifications.id, item.id),
                eq(notifications.tenantId, item.tenantId),
                eq(notifications.eventId, item.eventId),
                eq(notifications.status, "queued"),
              ),
            )
            .returning({ attemptCount: notifications.attemptCount })
        )[0] ?? null
      );
    },

    async createAttempt(item, attemptNumber, startedAt) {
      return (
        (
          await getDatabase()
            .insert(notificationAttempts)
            .values({
              tenantId: item.tenantId,
              notificationId: item.id,
              attemptNumber,
              startedAt,
              status: "sending",
            })
            .returning({ id: notificationAttempts.id })
        )[0] ?? null
      );
    },

    async findLineUserId(tenantId, userId) {
      return (
        (
          await getDatabase()
            .select({ lineUserId: userIdentities.providerUserId })
            .from(userIdentities)
            .where(
              and(
                eq(userIdentities.tenantId, tenantId),
                eq(userIdentities.userId, userId),
                eq(userIdentities.provider, "line"),
              ),
            )
            .limit(1)
        )[0]?.lineUserId ?? null
      );
    },

    async markSent(scope, attemptId, providerMessageId, sentAt) {
      await getDatabase().transaction(async (transaction) => {
        await transaction
          .update(notifications)
          .set({
            status: "sent",
            sentAt,
            errorCode: null,
            errorMessage: null,
            updatedAt: sentAt,
          })
          .where(
            and(
              eq(notifications.id, scope.id),
              eq(notifications.tenantId, scope.tenantId),
              eq(notifications.eventId, scope.eventId),
            ),
          );
        if (attemptId)
          await transaction
            .update(notificationAttempts)
            .set({
              status: "sent",
              finishedAt: sentAt,
              providerMessageId,
              updatedAt: sentAt,
            })
            .where(and(eq(notificationAttempts.id, attemptId), eq(notificationAttempts.tenantId, scope.tenantId)));
      });
    },

    async markFailed(scope, attemptId, errorCode, failedAt) {
      await getDatabase().transaction(async (transaction) => {
        await transaction
          .update(notifications)
          .set({
            status: "failed",
            errorCode,
            errorMessage: errorCode,
            updatedAt: failedAt,
          })
          .where(
            and(
              eq(notifications.id, scope.id),
              eq(notifications.tenantId, scope.tenantId),
              eq(notifications.eventId, scope.eventId),
            ),
          );
        if (attemptId)
          await transaction
            .update(notificationAttempts)
            .set({ status: "failed", finishedAt: failedAt, errorCode, updatedAt: failedAt })
            .where(and(eq(notificationAttempts.id, attemptId), eq(notificationAttempts.tenantId, scope.tenantId)));
      });
    },

    async recordScheduleRun(tenantIds, status, summary, occurredAt) {
      await getDatabase()
        .update(jobSchedules)
        .set({
          lastRunAt: occurredAt,
          lastRunStatus: status,
          lastRunSummary: notificationDispatchSummarySchema.parse(summary),
          updatedAt: occurredAt,
        })
        .where(and(eq(jobSchedules.jobKey, "notification_dispatch"), inArray(jobSchedules.tenantId, tenantIds)));
    },
  };
}
