import { and, count, desc, eq, inArray, sql } from "drizzle-orm";

import {
  auditLogs,
  conciergeAccessLogs,
  conciergeAnswerRevisions,
  conciergeAnswers,
  conciergeRuleResults,
  conciergeSessions,
  eventConciergeSnapshots,
  getDatabase,
  participants,
} from "@shime/db";

import type { ConciergeDiagnosisRepository } from "./repository";
import { parseActiveDiagnosis } from "./snapshot";
import type { DiagnosisConfiguration, DiagnosisSession, DiagnosisStoredResult } from "./types";

function mapConfiguration(row: typeof eventConciergeSnapshots.$inferSelect): DiagnosisConfiguration {
  return {
    id: row.id,
    snapshotHash: row.snapshotHash,
    snapshot: row.snapshot,
    enabled: row.enabled,
    accessOpensAt: row.accessOpensAt,
    accessClosesAt: row.accessClosesAt,
    allowResubmission: row.allowResubmission,
  };
}

function mapSession(row: typeof conciergeSessions.$inferSelect): DiagnosisSession {
  return {
    id: row.id,
    snapshotId: row.snapshotId,
    status: row.status,
    revision: row.revision,
    selectedCardAssetVersionId: row.selectedCardAssetVersionId,
    startedAt: row.startedAt,
    submittedAt: row.submittedAt,
  };
}

function mapResult(row: typeof conciergeRuleResults.$inferSelect): DiagnosisStoredResult {
  return {
    id: row.id,
    submittedRevision: row.submittedRevision,
    algorithmVersion: row.algorithmVersion,
    primaryEmotionCode: row.primaryEmotionCode,
    resultSnapshot: row.resultSnapshot,
    createdAt: row.createdAt,
  };
}

export function createDrizzleConciergeDiagnosisRepository(): ConciergeDiagnosisRepository {
  const repository: ConciergeDiagnosisRepository = {
    async findConfiguration(scope) {
      const [row] = await getDatabase()
        .select()
        .from(eventConciergeSnapshots)
        .where(
          and(eq(eventConciergeSnapshots.tenantId, scope.tenantId), eq(eventConciergeSnapshots.eventId, scope.eventId)),
        )
        .limit(1);
      return row ? mapConfiguration(row) : null;
    },

    async findSession(scope) {
      const [row] = await getDatabase()
        .select()
        .from(conciergeSessions)
        .where(
          and(
            eq(conciergeSessions.tenantId, scope.tenantId),
            eq(conciergeSessions.eventId, scope.eventId),
            eq(conciergeSessions.participantId, scope.participantId),
          ),
        )
        .limit(1);
      return row ? mapSession(row) : null;
    },

    async listAnswers(scope, sessionId) {
      return getDatabase()
        .select({ axisCode: conciergeAnswers.axisCode, optionCode: conciergeAnswers.optionCode })
        .from(conciergeAnswers)
        .where(
          and(
            eq(conciergeAnswers.tenantId, scope.tenantId),
            eq(conciergeAnswers.eventId, scope.eventId),
            eq(conciergeAnswers.sessionId, sessionId),
          ),
        );
    },

    async findLatestResult(scope, sessionId) {
      const [row] = await getDatabase()
        .select()
        .from(conciergeRuleResults)
        .where(
          and(
            eq(conciergeRuleResults.tenantId, scope.tenantId),
            eq(conciergeRuleResults.eventId, scope.eventId),
            eq(conciergeRuleResults.sessionId, sessionId),
          ),
        )
        .orderBy(desc(conciergeRuleResults.createdAt))
        .limit(1);
      return row ? mapResult(row) : null;
    },

    async createSession(scope, snapshotId, now) {
      const [row] = await getDatabase()
        .insert(conciergeSessions)
        .values({
          tenantId: scope.tenantId,
          eventId: scope.eventId,
          participantId: scope.participantId,
          snapshotId,
          status: "in_progress",
          startedAt: now,
        })
        .onConflictDoNothing({
          target: [conciergeSessions.tenantId, conciergeSessions.eventId, conciergeSessions.participantId],
        })
        .returning();
      if (row) return mapSession(row);
      const existing = await repository.findSession(scope);
      if (!existing) throw new Error("CONCIERGE_SESSION_CREATE_FAILED");
      return existing;
    },

    async reopenSession(scope, sessionId, now) {
      const [row] = await getDatabase()
        .update(conciergeSessions)
        .set({
          status: "in_progress",
          submittedAt: null,
          revision: sql`${conciergeSessions.revision} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(conciergeSessions.id, sessionId),
            eq(conciergeSessions.tenantId, scope.tenantId),
            eq(conciergeSessions.eventId, scope.eventId),
            eq(conciergeSessions.participantId, scope.participantId),
            eq(conciergeSessions.status, "submitted"),
          ),
        )
        .returning();
      return row ? mapSession(row) : null;
    },

    async saveDraft(scope, sessionId, input, now) {
      return getDatabase().transaction(async (transaction) => {
        const [row] = await transaction
          .update(conciergeSessions)
          .set({
            selectedCardAssetVersionId: input.selectedCardAssetVersionId,
            revision: sql`${conciergeSessions.revision} + 1`,
            updatedAt: now,
          })
          .where(
            and(
              eq(conciergeSessions.id, sessionId),
              eq(conciergeSessions.tenantId, scope.tenantId),
              eq(conciergeSessions.eventId, scope.eventId),
              eq(conciergeSessions.participantId, scope.participantId),
              eq(conciergeSessions.status, "in_progress"),
              eq(conciergeSessions.revision, input.expectedRevision),
            ),
          )
          .returning();
        if (!row) return null;

        await transaction
          .delete(conciergeAnswers)
          .where(
            and(
              eq(conciergeAnswers.tenantId, scope.tenantId),
              eq(conciergeAnswers.eventId, scope.eventId),
              eq(conciergeAnswers.sessionId, sessionId),
            ),
          );
        if (input.answers.length > 0) {
          await transaction.insert(conciergeAnswers).values(
            input.answers.map((answer) => ({
              tenantId: scope.tenantId,
              eventId: scope.eventId,
              sessionId,
              axisCode: answer.axisCode,
              optionCode: answer.optionCode,
            })),
          );
        }
        await transaction.insert(conciergeAnswerRevisions).values({
          tenantId: scope.tenantId,
          eventId: scope.eventId,
          sessionId,
          revision: row.revision,
          answerSnapshot: {
            selectedCardAssetVersionId: input.selectedCardAssetVersionId,
            answers: input.answers,
          },
          createdAt: now,
        });
        return mapSession(row);
      });
    },

    async submit(scope, sessionId, expectedRevision, result, now) {
      return getDatabase().transaction(async (transaction) => {
        const [row] = await transaction
          .update(conciergeSessions)
          .set({ status: "submitted", submittedAt: now, updatedAt: now })
          .where(
            and(
              eq(conciergeSessions.id, sessionId),
              eq(conciergeSessions.tenantId, scope.tenantId),
              eq(conciergeSessions.eventId, scope.eventId),
              eq(conciergeSessions.participantId, scope.participantId),
              eq(conciergeSessions.status, "in_progress"),
              eq(conciergeSessions.revision, expectedRevision),
            ),
          )
          .returning();
        if (!row) return null;
        await transaction.insert(conciergeRuleResults).values({
          tenantId: scope.tenantId,
          eventId: scope.eventId,
          sessionId,
          submittedRevision: expectedRevision,
          algorithmVersion: result.algorithmVersion,
          primaryEmotionCode: result.primaryEmotion.code,
          resultSnapshot: result,
          createdAt: now,
        });
        return mapSession(row);
      });
    },

    async logAccess(scope, sessionId, action, now) {
      await getDatabase().insert(conciergeAccessLogs).values({
        tenantId: scope.tenantId,
        eventId: scope.eventId,
        participantId: scope.participantId,
        sessionId,
        viewerUserId: scope.userId,
        action,
        createdAt: now,
      });
    },

    async getCardObjectKey(scope, cardAssetVersionId) {
      const configuration = await repository.findConfiguration(scope);
      if (!configuration?.enabled) return null;
      const diagnosis = parseActiveDiagnosis(configuration.snapshot);
      return diagnosis?.cards.find((card) => card.id === cardAssetVersionId)?.storageObjectKey ?? null;
    },

    async updateEventSettings(input) {
      return getDatabase().transaction(async (transaction) => {
        const [existing] = await transaction
          .select()
          .from(eventConciergeSnapshots)
          .where(
            and(
              eq(eventConciergeSnapshots.tenantId, input.tenantId),
              eq(eventConciergeSnapshots.eventId, input.eventId),
            ),
          )
          .for("update")
          .limit(1);
        if (!existing || (input.enabled && !parseActiveDiagnosis(existing.snapshot))) return null;
        const [row] = await transaction
          .update(eventConciergeSnapshots)
          .set({
            enabled: input.enabled,
            accessOpensAt: input.accessOpensAt,
            accessClosesAt: input.accessClosesAt,
            allowResubmission: input.allowResubmission,
          })
          .where(
            and(
              eq(eventConciergeSnapshots.id, existing.id),
              eq(eventConciergeSnapshots.tenantId, input.tenantId),
              eq(eventConciergeSnapshots.eventId, input.eventId),
            ),
          )
          .returning();
        if (!row) return null;
        await transaction.insert(auditLogs).values({
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          eventId: input.eventId,
          action: "concierge.event_settings.updated",
          targetType: "event_concierge_snapshot",
          targetId: row.id,
          before: {
            enabled: existing.enabled,
            accessOpensAt: existing.accessOpensAt,
            accessClosesAt: existing.accessClosesAt,
            allowResubmission: existing.allowResubmission,
          },
          after: {
            enabled: row.enabled,
            accessOpensAt: row.accessOpensAt,
            accessClosesAt: row.accessClosesAt,
            allowResubmission: row.allowResubmission,
          },
          requestId: input.requestId,
        });
        return mapConfiguration(row);
      });
    },

    async getStatusSummary(scope) {
      const configuration = await repository.findConfiguration(scope);
      if (!configuration) return null;
      const [eligible, sessions] = await Promise.all([
        getDatabase()
          .select({ value: count() })
          .from(participants)
          .where(
            and(
              eq(participants.tenantId, scope.tenantId),
              eq(participants.eventId, scope.eventId),
              inArray(participants.status, ["confirmed", "attended"]),
            ),
          ),
        getDatabase()
          .select({ status: conciergeSessions.status })
          .from(conciergeSessions)
          .where(and(eq(conciergeSessions.tenantId, scope.tenantId), eq(conciergeSessions.eventId, scope.eventId))),
      ]);
      const eligibleCount = eligible[0]?.value ?? 0;
      const inProgressCount = sessions.filter((session) => session.status === "in_progress").length;
      const submittedCount = sessions.filter((session) => session.status === "submitted").length;
      return {
        eligibleCount,
        notStartedCount: Math.max(0, eligibleCount - inProgressCount - submittedCount),
        inProgressCount,
        submittedCount,
      };
    },
  };
  return repository;
}
