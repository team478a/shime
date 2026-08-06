import { and, asc, desc, eq, inArray, max } from "drizzle-orm";
import { auditLogs, eventInteractionNoteSnapshots, events, getDatabase, interactionNoteOptions } from "@shime/db";
import type { InteractionMemoAdminRepository, InteractionMemoLifecycleResult } from "./admin-repository";
import type { InteractionMemoAdminScope, InteractionMemoAdminSnapshot } from "./admin-types";
import { interactionMemoSnapshotStatusSchema } from "./admin-types";
import { interactionPublicProfileFieldKeysSchema, interactionTargetSourceSchema } from "./types";

type SnapshotRow = typeof eventInteractionNoteSnapshots.$inferSelect;

function toSnapshot(
  row: SnapshotRow,
  options: Array<typeof interactionNoteOptions.$inferSelect>,
): InteractionMemoAdminSnapshot {
  return {
    id: row.id,
    version: row.version,
    status: interactionMemoSnapshotStatusSchema.parse(row.status),
    enabled: row.enabled,
    targetSource: interactionTargetSourceSchema.parse(row.targetSource),
    publicProfileFieldKeys: interactionPublicProfileFieldKeysSchema.parse(row.publicProfileFieldKeys),
    editableUntil: row.editableUntil?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    stoppedAt: row.stoppedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    options: options.map((option) => ({
      code: option.code,
      label: option.label,
      displayOrder: option.displayOrder,
      enabled: option.enabled,
      isNegative: option.isNegative,
    })),
  };
}

async function eventExists(scope: InteractionMemoAdminScope) {
  return Boolean(
    (
      await getDatabase()
        .select({ id: events.id })
        .from(events)
        .where(and(eq(events.tenantId, scope.tenantId), eq(events.id, scope.eventId)))
        .limit(1)
    )[0],
  );
}

export function createDrizzleInteractionMemoAdminRepository(): InteractionMemoAdminRepository {
  const listSnapshots: InteractionMemoAdminRepository["listSnapshots"] = async (scope) => {
    const rows = await getDatabase()
      .select()
      .from(eventInteractionNoteSnapshots)
      .where(
        and(
          eq(eventInteractionNoteSnapshots.tenantId, scope.tenantId),
          eq(eventInteractionNoteSnapshots.eventId, scope.eventId),
          eq(eventInteractionNoteSnapshots.serviceType, scope.serviceType),
        ),
      )
      .orderBy(desc(eventInteractionNoteSnapshots.version));
    const snapshotIds = rows.map((row) => row.id);
    const optionRows = snapshotIds.length
      ? await getDatabase()
          .select()
          .from(interactionNoteOptions)
          .where(
            and(
              eq(interactionNoteOptions.tenantId, scope.tenantId),
              eq(interactionNoteOptions.eventId, scope.eventId),
              eq(interactionNoteOptions.serviceType, scope.serviceType),
              inArray(interactionNoteOptions.snapshotId, snapshotIds),
            ),
          )
          .orderBy(asc(interactionNoteOptions.displayOrder))
      : [];
    return rows.map((row) =>
      toSnapshot(
        row,
        optionRows.filter((option) => option.snapshotId === row.id),
      ),
    );
  };

  return {
    listSnapshots,
    async createDraft(scope, input): Promise<InteractionMemoLifecycleResult> {
      if (!(await eventExists(scope))) return { status: "event_not_found" };
      const snapshotId = await getDatabase().transaction(async (tx) => {
        const current = (
          await tx
            .select({ value: max(eventInteractionNoteSnapshots.version) })
            .from(eventInteractionNoteSnapshots)
            .where(
              and(
                eq(eventInteractionNoteSnapshots.tenantId, scope.tenantId),
                eq(eventInteractionNoteSnapshots.eventId, scope.eventId),
                eq(eventInteractionNoteSnapshots.serviceType, scope.serviceType),
              ),
            )
        )[0]?.value;
        const snapshot = (
          await tx
            .insert(eventInteractionNoteSnapshots)
            .values({
              tenantId: scope.tenantId,
              eventId: scope.eventId,
              serviceType: scope.serviceType,
              version: (current ?? 0) + 1,
              enabled: false,
              status: "draft",
              targetSource: input.targetSource,
              publicProfileFieldKeys: input.publicProfileFieldKeys,
              editableUntil: input.editableUntil ? new Date(input.editableUntil) : null,
              createdBy: scope.actorUserId,
            })
            .returning({ id: eventInteractionNoteSnapshots.id, version: eventInteractionNoteSnapshots.version })
        )[0];
        if (!snapshot) throw new Error("INTERACTION_MEMO_DRAFT_INSERT_FAILED");
        await tx.insert(interactionNoteOptions).values(
          input.options.map((option, index) => ({
            tenantId: scope.tenantId,
            eventId: scope.eventId,
            serviceType: scope.serviceType,
            snapshotId: snapshot.id,
            code: option.code,
            label: option.label,
            displayOrder: index + 1,
            enabled: option.enabled,
            isNegative: option.isNegative,
          })),
        );
        await tx.insert(auditLogs).values({
          tenantId: scope.tenantId,
          actorUserId: scope.actorUserId,
          eventId: scope.eventId,
          action: "interaction_memo.snapshot_draft_created",
          targetType: "event_interaction_note_snapshot",
          targetId: snapshot.id,
          after: { version: snapshot.version, option_count: input.options.length },
          requestId: scope.requestId,
        });
        return snapshot.id;
      });
      const snapshot = (await listSnapshots(scope)).find((item) => item.id === snapshotId);
      return snapshot ? { status: "updated", snapshot } : { status: "snapshot_not_found" };
    },
    async publish(scope, snapshotId, now): Promise<InteractionMemoLifecycleResult> {
      const result = await getDatabase().transaction(async (tx) => {
        const target = (
          await tx
            .select()
            .from(eventInteractionNoteSnapshots)
            .where(
              and(
                eq(eventInteractionNoteSnapshots.tenantId, scope.tenantId),
                eq(eventInteractionNoteSnapshots.eventId, scope.eventId),
                eq(eventInteractionNoteSnapshots.serviceType, scope.serviceType),
                eq(eventInteractionNoteSnapshots.id, snapshotId),
              ),
            )
            .limit(1)
        )[0];
        if (!target) return "snapshot_not_found" as const;
        if (target.status !== "draft" || (target.editableUntil && target.editableUntil <= now)) {
          return "invalid_state" as const;
        }
        await tx
          .update(eventInteractionNoteSnapshots)
          .set({ enabled: false, status: "stopped", stoppedAt: now, updatedAt: now })
          .where(
            and(
              eq(eventInteractionNoteSnapshots.tenantId, scope.tenantId),
              eq(eventInteractionNoteSnapshots.eventId, scope.eventId),
              eq(eventInteractionNoteSnapshots.serviceType, scope.serviceType),
              eq(eventInteractionNoteSnapshots.status, "published"),
            ),
          );
        await tx
          .update(eventInteractionNoteSnapshots)
          .set({ enabled: true, status: "published", publishedAt: now, stoppedAt: null, updatedAt: now })
          .where(eq(eventInteractionNoteSnapshots.id, snapshotId));
        await tx.insert(auditLogs).values({
          tenantId: scope.tenantId,
          actorUserId: scope.actorUserId,
          eventId: scope.eventId,
          action: "interaction_memo.snapshot_published",
          targetType: "event_interaction_note_snapshot",
          targetId: snapshotId,
          after: { version: target.version },
          requestId: scope.requestId,
        });
        return "updated" as const;
      });
      if (result !== "updated") return { status: result };
      const snapshot = (await listSnapshots(scope)).find((item) => item.id === snapshotId);
      return snapshot ? { status: "updated", snapshot } : { status: "snapshot_not_found" };
    },
    async stop(scope, snapshotId, now): Promise<InteractionMemoLifecycleResult> {
      const target = (await listSnapshots(scope)).find((item) => item.id === snapshotId);
      if (!target) return { status: "snapshot_not_found" };
      if (target.status !== "published") return { status: "invalid_state" };
      await getDatabase().transaction(async (tx) => {
        await tx
          .update(eventInteractionNoteSnapshots)
          .set({ enabled: false, status: "stopped", stoppedAt: now, updatedAt: now })
          .where(
            and(
              eq(eventInteractionNoteSnapshots.tenantId, scope.tenantId),
              eq(eventInteractionNoteSnapshots.eventId, scope.eventId),
              eq(eventInteractionNoteSnapshots.serviceType, scope.serviceType),
              eq(eventInteractionNoteSnapshots.id, snapshotId),
              eq(eventInteractionNoteSnapshots.status, "published"),
            ),
          );
        await tx.insert(auditLogs).values({
          tenantId: scope.tenantId,
          actorUserId: scope.actorUserId,
          eventId: scope.eventId,
          action: "interaction_memo.snapshot_stopped",
          targetType: "event_interaction_note_snapshot",
          targetId: snapshotId,
          before: { version: target.version, status: "published" },
          after: { version: target.version, status: "stopped" },
          requestId: scope.requestId,
        });
      });
      const stopped = (await listSnapshots(scope)).find((item) => item.id === snapshotId);
      return stopped ? { status: "updated", snapshot: stopped } : { status: "snapshot_not_found" };
    },
  };
}
