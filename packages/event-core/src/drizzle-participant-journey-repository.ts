import { and, desc, eq, max } from "drizzle-orm";

import { auditLogs, eventConciergeSnapshots, eventJourneyVersions, events, getDatabase } from "@shime/db";

import type { ParticipantJourneyRepository } from "./participant-journey-repository";
import {
  DEFAULT_PARTICIPANT_JOURNEY,
  participantJourneyStepsSchema,
  type ParticipantJourneyVersion,
} from "./participant-journey-types";

function parseVersion(row: typeof eventJourneyVersions.$inferSelect): ParticipantJourneyVersion {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    steps: participantJourneyStepsSchema.parse(row.steps),
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
  };
}

export function createDrizzleParticipantJourneyRepository(): ParticipantJourneyRepository {
  return {
    async getSettings(scope) {
      const db = getDatabase();
      const [event] = await db
        .select({ id: events.id })
        .from(events)
        .where(and(eq(events.id, scope.eventId), eq(events.tenantId, scope.tenantId)))
        .limit(1);
      if (!event) return null;
      const versions = await db
        .select()
        .from(eventJourneyVersions)
        .where(and(eq(eventJourneyVersions.tenantId, scope.tenantId), eq(eventJourneyVersions.eventId, scope.eventId)))
        .orderBy(desc(eventJourneyVersions.version));
      const draft = versions.find((version) => version.status === "draft");
      const published = versions.find((version) => version.status === "published");
      return {
        draft: draft ? parseVersion(draft) : null,
        published: published ? parseVersion(published) : null,
        effectiveSteps: published ? parseVersion(published).steps : DEFAULT_PARTICIPANT_JOURNEY,
      };
    },

    async isDiagnosisAvailable(scope) {
      const [snapshot] = await getDatabase()
        .select({ id: eventConciergeSnapshots.id })
        .from(eventConciergeSnapshots)
        .where(
          and(
            eq(eventConciergeSnapshots.tenantId, scope.tenantId),
            eq(eventConciergeSnapshots.eventId, scope.eventId),
            eq(eventConciergeSnapshots.enabled, true),
          ),
        )
        .limit(1);
      return Boolean(snapshot);
    },

    async saveDraft(input) {
      return getDatabase().transaction(async (tx) => {
        const [event] = await tx
          .select({ id: events.id })
          .from(events)
          .where(and(eq(events.id, input.eventId), eq(events.tenantId, input.tenantId)))
          .for("update")
          .limit(1);
        if (!event) return null;
        const [draft] = await tx
          .select()
          .from(eventJourneyVersions)
          .where(
            and(
              eq(eventJourneyVersions.tenantId, input.tenantId),
              eq(eventJourneyVersions.eventId, input.eventId),
              eq(eventJourneyVersions.status, "draft"),
            ),
          )
          .orderBy(desc(eventJourneyVersions.version))
          .limit(1);
        const [saved] = draft
          ? await tx
              .update(eventJourneyVersions)
              .set({ steps: input.steps, updatedAt: input.now })
              .where(
                and(
                  eq(eventJourneyVersions.id, draft.id),
                  eq(eventJourneyVersions.tenantId, input.tenantId),
                  eq(eventJourneyVersions.eventId, input.eventId),
                ),
              )
              .returning()
          : await tx
              .insert(eventJourneyVersions)
              .values({
                tenantId: input.tenantId,
                eventId: input.eventId,
                version:
                  ((
                    await tx
                      .select({ value: max(eventJourneyVersions.version) })
                      .from(eventJourneyVersions)
                      .where(
                        and(
                          eq(eventJourneyVersions.tenantId, input.tenantId),
                          eq(eventJourneyVersions.eventId, input.eventId),
                        ),
                      )
                  )[0]?.value ?? 0) + 1,
                status: "draft",
                steps: input.steps,
                createdBy: input.actorUserId,
              })
              .returning();
        if (!saved) throw new Error("JOURNEY_DRAFT_SAVE_FAILED");
        await tx.insert(auditLogs).values({
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          eventId: input.eventId,
          action: "event.journey.draft_saved",
          targetType: "event_journey_version",
          targetId: saved.id,
          after: { version: saved.version, steps: input.steps },
          requestId: input.requestId,
        });
        return parseVersion(saved);
      });
    },

    async publishDraft(input) {
      return getDatabase().transaction(async (tx) => {
        const [event] = await tx
          .select({ id: events.id })
          .from(events)
          .where(and(eq(events.id, input.eventId), eq(events.tenantId, input.tenantId)))
          .for("update")
          .limit(1);
        if (!event) return null;
        const [draft] = await tx
          .select()
          .from(eventJourneyVersions)
          .where(
            and(
              eq(eventJourneyVersions.tenantId, input.tenantId),
              eq(eventJourneyVersions.eventId, input.eventId),
              eq(eventJourneyVersions.status, "draft"),
            ),
          )
          .orderBy(desc(eventJourneyVersions.version))
          .limit(1);
        if (!draft) return null;
        await tx
          .update(eventJourneyVersions)
          .set({
            status: "archived",
            archivedAt: input.now,
            updatedAt: input.now,
          })
          .where(
            and(
              eq(eventJourneyVersions.tenantId, input.tenantId),
              eq(eventJourneyVersions.eventId, input.eventId),
              eq(eventJourneyVersions.status, "published"),
            ),
          );
        const [published] = await tx
          .update(eventJourneyVersions)
          .set({
            status: "published",
            publishedAt: input.now,
            updatedAt: input.now,
          })
          .where(
            and(
              eq(eventJourneyVersions.id, draft.id),
              eq(eventJourneyVersions.tenantId, input.tenantId),
              eq(eventJourneyVersions.eventId, input.eventId),
            ),
          )
          .returning();
        if (!published) throw new Error("JOURNEY_PUBLISH_FAILED");
        await tx.insert(auditLogs).values({
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          eventId: input.eventId,
          action: "event.journey.published",
          targetType: "event_journey_version",
          targetId: published.id,
          after: { version: published.version, steps: published.steps },
          requestId: input.requestId,
        });
        return parseVersion(published);
      });
    },
  };
}
