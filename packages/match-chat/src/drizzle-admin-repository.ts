import { and, asc, eq, inArray, lte, ne, or } from "drizzle-orm";
import {
  auditLogs,
  eventMatchChatConfigs,
  events,
  getDatabase,
  matchChatMessages,
  matchChatReports,
  participants,
} from "@shime/db";
import type { MatchChatAdminRepository } from "./repository";
import { type MatchChatAdminReport, type MatchChatAdminScope, matchChatConfigSchema } from "./types";

const configSelection = {
  enabled: eventMatchChatConfigs.enabled,
  windowHours: eventMatchChatConfigs.windowHours,
  messagesPerMinute: eventMatchChatConfigs.messagesPerMinute,
  maxMessageLength: eventMatchChatConfigs.maxMessageLength,
  termsVersion: eventMatchChatConfigs.termsVersion,
  retentionDays: eventMatchChatConfigs.retentionDays,
};

async function findEvent(scope: MatchChatAdminScope) {
  return (
    await getDatabase()
      .select({ id: events.id, name: events.name })
      .from(events)
      .where(and(eq(events.tenantId, scope.tenantId), eq(events.id, scope.eventId)))
      .limit(1)
  )[0];
}

async function listReports(scope: MatchChatAdminScope): Promise<MatchChatAdminReport[]> {
  const rows = await getDatabase()
    .select({
      id: matchChatReports.id,
      roomId: matchChatReports.roomId,
      reporterParticipantId: matchChatReports.reporterParticipantId,
      reportedParticipantId: matchChatReports.reportedParticipantId,
      category: matchChatReports.category,
      detail: matchChatReports.detail,
      status: matchChatReports.status,
      createdAt: matchChatReports.createdAt,
      resolvedAt: matchChatReports.resolvedAt,
    })
    .from(matchChatReports)
    .where(and(eq(matchChatReports.tenantId, scope.tenantId), eq(matchChatReports.eventId, scope.eventId)))
    .orderBy(asc(matchChatReports.status), asc(matchChatReports.createdAt));
  const participantIds = [...new Set(rows.flatMap((row) => [row.reporterParticipantId, row.reportedParticipantId]))];
  const participantRows = participantIds.length
    ? await getDatabase()
        .select({ id: participants.id, participantNumber: participants.participantNumber })
        .from(participants)
        .where(
          and(
            eq(participants.tenantId, scope.tenantId),
            eq(participants.eventId, scope.eventId),
            inArray(participants.id, participantIds),
          ),
        )
    : [];
  const participantNumbers = new Map(participantRows.map((row) => [row.id, row.participantNumber]));
  return rows.map((row) => ({
    id: row.id,
    roomId: row.roomId,
    reporterParticipantNumber: participantNumbers.get(row.reporterParticipantId) ?? null,
    reportedParticipantNumber: participantNumbers.get(row.reportedParticipantId) ?? null,
    category: matchChatConfigReportCategory(row.category),
    detail: row.detail,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  }));
}

function matchChatConfigReportCategory(value: string): MatchChatAdminReport["category"] {
  if (["harassment", "spam", "inappropriate", "safety_concern", "other"].includes(value)) {
    return value as MatchChatAdminReport["category"];
  }
  throw new Error("INVALID_MATCH_CHAT_REPORT_CATEGORY");
}

export function createDrizzleMatchChatAdminRepository(): MatchChatAdminRepository {
  return {
    async loadWorkspace(scope) {
      const event = await findEvent(scope);
      if (!event) return null;
      const configRow = (
        await getDatabase()
          .select(configSelection)
          .from(eventMatchChatConfigs)
          .where(
            and(
              eq(eventMatchChatConfigs.tenantId, scope.tenantId),
              eq(eventMatchChatConfigs.eventId, scope.eventId),
              eq(eventMatchChatConfigs.serviceType, scope.serviceType),
            ),
          )
          .limit(1)
      )[0];
      return {
        eventName: event.name,
        config: configRow ? matchChatConfigSchema.parse(configRow) : null,
        reports: await listReports(scope),
      };
    },

    async saveConfig(scope, config, now) {
      const saved = await getDatabase().transaction(async (tx) => {
        const targetEvent = (
          await tx
            .select({ id: events.id })
            .from(events)
            .where(and(eq(events.tenantId, scope.tenantId), eq(events.id, scope.eventId)))
            .limit(1)
            .for("update")
        )[0];
        if (!targetEvent) return null;
        const before = (
          await tx
            .select(configSelection)
            .from(eventMatchChatConfigs)
            .where(
              and(
                eq(eventMatchChatConfigs.tenantId, scope.tenantId),
                eq(eventMatchChatConfigs.eventId, scope.eventId),
                eq(eventMatchChatConfigs.serviceType, scope.serviceType),
              ),
            )
            .limit(1)
        )[0];
        const row = (
          await tx
            .insert(eventMatchChatConfigs)
            .values({
              tenantId: scope.tenantId,
              eventId: scope.eventId,
              serviceType: scope.serviceType,
              ...config,
              updatedBy: scope.actorUserId,
              createdAt: now,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: [
                eventMatchChatConfigs.tenantId,
                eventMatchChatConfigs.eventId,
                eventMatchChatConfigs.serviceType,
              ],
              set: { ...config, updatedBy: scope.actorUserId, updatedAt: now },
            })
            .returning(configSelection)
        )[0];
        await tx.insert(auditLogs).values({
          tenantId: scope.tenantId,
          actorUserId: scope.actorUserId,
          eventId: scope.eventId,
          action: "match_chat.config_updated",
          targetType: "event_match_chat_config",
          before: before ?? null,
          after: config,
          requestId: scope.requestId,
        });
        return row;
      });
      return saved ? matchChatConfigSchema.parse(saved) : null;
    },

    async updateReportStatus(scope, reportId, status, now) {
      const updated = await getDatabase().transaction(async (tx) => {
        const current = (
          await tx
            .select({ id: matchChatReports.id, status: matchChatReports.status })
            .from(matchChatReports)
            .where(
              and(
                eq(matchChatReports.tenantId, scope.tenantId),
                eq(matchChatReports.eventId, scope.eventId),
                eq(matchChatReports.id, reportId),
              ),
            )
            .limit(1)
            .for("update")
        )[0];
        if (!current) return false;
        if (current.status === status) return true;
        if (current.status === "resolved") return false;
        const result = await tx
          .update(matchChatReports)
          .set({
            status,
            resolvedAt: status === "resolved" ? now : null,
            resolvedBy: status === "resolved" ? scope.actorUserId : null,
            updatedAt: now,
          })
          .where(
            and(
              eq(matchChatReports.tenantId, scope.tenantId),
              eq(matchChatReports.eventId, scope.eventId),
              eq(matchChatReports.id, reportId),
              ne(matchChatReports.status, "resolved"),
            ),
          )
          .returning({ id: matchChatReports.id });
        if (!result[0]) return false;
        await tx.insert(auditLogs).values({
          tenantId: scope.tenantId,
          actorUserId: scope.actorUserId,
          eventId: scope.eventId,
          action: "match_chat.report_status_updated",
          targetType: "match_chat_report",
          targetId: reportId,
          before: { status: current.status },
          after: { status },
          requestId: scope.requestId,
        });
        return true;
      });
      if (!updated) return null;
      return (await listReports(scope)).find((report) => report.id === reportId) ?? null;
    },

    async purgeExpiredMessages(now, limit) {
      return getDatabase().transaction(async (tx) => {
        const expired = await tx
          .select({ id: matchChatMessages.id })
          .from(matchChatMessages)
          .where(or(lte(matchChatMessages.expiresAt, now), lte(matchChatMessages.deletedAt, now)))
          .orderBy(asc(matchChatMessages.expiresAt), asc(matchChatMessages.id))
          .limit(limit)
          .for("update", { skipLocked: true });
        if (!expired.length) return 0;
        const deleted = await tx
          .delete(matchChatMessages)
          .where(
            inArray(
              matchChatMessages.id,
              expired.map((row) => row.id),
            ),
          )
          .returning({ id: matchChatMessages.id });
        return deleted.length;
      });
    },
  };
}
