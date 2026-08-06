import { and, eq, gt, inArray, isNotNull, isNull, or } from "drizzle-orm";
import {
  auditLogs,
  eventInteractionNoteSnapshots,
  getDatabase,
  interactionNoteOptions,
  interactionNotes,
  interactionSlotParticipants,
  interactionSlots,
  participantAvoidances,
  participants,
} from "@shime/db";
import type { SaveInteractionMemoRepositoryResult } from "./repository";
import type { InteractionMemoAuditScope, InteractionMemoSnapshot, SaveInteractionMemoInput } from "./types";

type Transaction = Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];

export async function saveOwnNoteWithDrizzle(
  scope: InteractionMemoAuditScope,
  snapshot: InteractionMemoSnapshot,
  input: SaveInteractionMemoInput,
  now: Date,
): Promise<SaveInteractionMemoRepositoryResult> {
  const privateNoteText = input.privateNoteText ?? "";
  const wantsToTalkMore = input.wantsToTalkMore ?? false;
  try {
    return await getDatabase().transaction(async (transaction) => {
      if (!(await snapshotIsWritable(transaction, scope, snapshot.id, now))) return { status: "closed" };
      if (!(await optionIsEnabled(transaction, scope, snapshot.id, input.feelingCode))) return { status: "closed" };
      if (!(await targetIsEligible(transaction, scope, input))) return { status: "invalid_target" };

      const existing = await findNote(transaction, scope, snapshot.id, input);
      if (existing) {
        if (
          existing.feelingCode === input.feelingCode &&
          existing.favorite === input.favorite &&
          existing.privateNoteText === privateNoteText &&
          existing.wantsToTalkMore === wantsToTalkMore
        )
          return { status: "saved", note: existing };
        if (existing.revision !== input.expectedRevision) return { status: "revision_conflict" };
        const updated = (
          await transaction
            .update(interactionNotes)
            .set({
              feelingCode: input.feelingCode,
              favorite: input.favorite,
              privateNoteText: privateNoteText || null,
              wantsToTalkMore,
              revision: existing.revision + 1,
              recordedAt: now,
              updatedAt: now,
            })
            .where(and(eq(interactionNotes.id, existing.id), eq(interactionNotes.revision, existing.revision)))
            .returning()
        )[0];
        if (!updated) return { status: "revision_conflict" };
        await writeAudit(transaction, scope, updated.id, existing.revision, updated.revision);
        return { status: "saved", note: toNote(updated) };
      }

      if (input.expectedRevision !== 0) return { status: "revision_conflict" };
      const inserted = (
        await transaction
          .insert(interactionNotes)
          .values({
            tenantId: scope.tenantId,
            eventId: scope.eventId,
            serviceType: scope.serviceType,
            snapshotId: snapshot.id,
            actorParticipantId: scope.participantId,
            targetParticipantId: input.targetParticipantId,
            interactionSlotId: input.interactionSlotId,
            feelingCode: input.feelingCode,
            favorite: input.favorite,
            privateNoteText: privateNoteText || null,
            wantsToTalkMore,
            recordedAt: now,
          })
          .returning()
      )[0]!;
      await writeAudit(transaction, scope, inserted.id, null, inserted.revision);
      return { status: "saved", note: toNote(inserted) };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "revision_conflict" };
    throw error;
  }
}

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "23505";

async function snapshotIsWritable(
  transaction: Transaction,
  scope: InteractionMemoAuditScope,
  snapshotId: string,
  now: Date,
) {
  return Boolean(
    (
      await transaction
        .select({ id: eventInteractionNoteSnapshots.id })
        .from(eventInteractionNoteSnapshots)
        .where(
          and(
            eq(eventInteractionNoteSnapshots.id, snapshotId),
            eq(eventInteractionNoteSnapshots.tenantId, scope.tenantId),
            eq(eventInteractionNoteSnapshots.eventId, scope.eventId),
            eq(eventInteractionNoteSnapshots.serviceType, scope.serviceType),
            eq(eventInteractionNoteSnapshots.enabled, true),
            or(
              isNull(eventInteractionNoteSnapshots.editableUntil),
              gt(eventInteractionNoteSnapshots.editableUntil, now),
            ),
          ),
        )
        .limit(1)
    )[0],
  );
}

async function targetIsEligible(
  transaction: Transaction,
  scope: InteractionMemoAuditScope,
  input: SaveInteractionMemoInput,
) {
  if (scope.participantId === input.targetParticipantId) return false;
  const memberships = await transaction
    .select({ participantId: interactionSlotParticipants.participantId })
    .from(interactionSlotParticipants)
    .innerJoin(
      interactionSlots,
      and(
        eq(interactionSlots.tenantId, interactionSlotParticipants.tenantId),
        eq(interactionSlots.eventId, interactionSlotParticipants.eventId),
        eq(interactionSlots.serviceType, interactionSlotParticipants.serviceType),
        eq(interactionSlots.id, interactionSlotParticipants.interactionSlotId),
      ),
    )
    .innerJoin(
      participants,
      and(
        eq(participants.tenantId, interactionSlotParticipants.tenantId),
        eq(participants.eventId, interactionSlotParticipants.eventId),
        eq(participants.id, interactionSlotParticipants.participantId),
      ),
    )
    .where(
      and(
        eq(interactionSlotParticipants.tenantId, scope.tenantId),
        eq(interactionSlotParticipants.eventId, scope.eventId),
        eq(interactionSlotParticipants.serviceType, scope.serviceType),
        eq(interactionSlotParticipants.interactionSlotId, input.interactionSlotId),
        inArray(interactionSlotParticipants.participantId, [scope.participantId, input.targetParticipantId]),
        eq(interactionSlots.status, "active"),
        inArray(participants.status, ["confirmed", "attended"]),
        isNotNull(participants.participantNumber),
      ),
    );
  if (new Set(memberships.map((row) => row.participantId)).size !== 2) return false;

  const avoidance = (
    await transaction
      .select({ id: participantAvoidances.id })
      .from(participantAvoidances)
      .where(
        and(
          eq(participantAvoidances.tenantId, scope.tenantId),
          eq(participantAvoidances.eventId, scope.eventId),
          or(
            and(
              eq(participantAvoidances.participantId, scope.participantId),
              eq(participantAvoidances.avoidedParticipantId, input.targetParticipantId),
            ),
            and(
              eq(participantAvoidances.participantId, input.targetParticipantId),
              eq(participantAvoidances.avoidedParticipantId, scope.participantId),
            ),
          ),
        ),
      )
      .limit(1)
  )[0];
  return !avoidance;
}

async function optionIsEnabled(
  transaction: Transaction,
  scope: InteractionMemoAuditScope,
  snapshotId: string,
  feelingCode: string,
) {
  return Boolean(
    (
      await transaction
        .select({ id: interactionNoteOptions.id })
        .from(interactionNoteOptions)
        .where(
          and(
            eq(interactionNoteOptions.tenantId, scope.tenantId),
            eq(interactionNoteOptions.eventId, scope.eventId),
            eq(interactionNoteOptions.serviceType, scope.serviceType),
            eq(interactionNoteOptions.snapshotId, snapshotId),
            eq(interactionNoteOptions.code, feelingCode),
            eq(interactionNoteOptions.enabled, true),
          ),
        )
        .limit(1)
    )[0],
  );
}

async function findNote(
  transaction: Transaction,
  scope: InteractionMemoAuditScope,
  snapshotId: string,
  input: SaveInteractionMemoInput,
) {
  const row = (
    await transaction
      .select()
      .from(interactionNotes)
      .where(
        and(
          eq(interactionNotes.tenantId, scope.tenantId),
          eq(interactionNotes.eventId, scope.eventId),
          eq(interactionNotes.serviceType, scope.serviceType),
          eq(interactionNotes.snapshotId, snapshotId),
          eq(interactionNotes.actorParticipantId, scope.participantId),
          eq(interactionNotes.targetParticipantId, input.targetParticipantId),
          eq(interactionNotes.interactionSlotId, input.interactionSlotId),
        ),
      )
      .limit(1)
  )[0];
  return row ? toNote(row) : null;
}

const toNote = (row: typeof interactionNotes.$inferSelect) => ({
  id: row.id,
  interactionSlotId: row.interactionSlotId,
  targetParticipantId: row.targetParticipantId,
  feelingCode: row.feelingCode,
  favorite: row.favorite,
  privateNoteText: row.privateNoteText ?? "",
  wantsToTalkMore: row.wantsToTalkMore,
  revision: row.revision,
  savedAt: row.recordedAt,
});

async function writeAudit(
  transaction: Transaction,
  scope: InteractionMemoAuditScope,
  noteId: string,
  beforeRevision: number | null,
  afterRevision: number,
) {
  await transaction.insert(auditLogs).values({
    tenantId: scope.tenantId,
    actorUserId: scope.actorUserId,
    eventId: scope.eventId,
    action: beforeRevision === null ? "interaction_note.created" : "interaction_note.updated",
    targetType: "interaction_note",
    targetId: noteId,
    before: beforeRevision === null ? null : { revision: beforeRevision },
    after: { revision: afterRevision },
    requestId: scope.requestId,
  });
}
