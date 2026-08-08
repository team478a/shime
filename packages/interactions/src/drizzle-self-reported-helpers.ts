import { and, eq, gt, inArray, isNotNull, isNull, or } from "drizzle-orm";
import {
  applications,
  auditLogs,
  checkins,
  eventInteractionNoteSnapshots,
  getDatabase,
  interactionNotes,
  interactionSlots,
  participantAvoidances,
  participants,
} from "@shime/db";
import type { InteractionMemoAuditScope, InteractionMemoScope } from "./types";

type Transaction = Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];

export async function participantIsCheckedIn(scope: InteractionMemoScope, participantId: string) {
  return Boolean(
    (
      await getDatabase()
        .select({ id: checkins.id })
        .from(checkins)
        .where(
          and(
            eq(checkins.tenantId, scope.tenantId),
            eq(checkins.eventId, scope.eventId),
            eq(checkins.participantId, participantId),
            eq(checkins.status, "checked_in"),
          ),
        )
        .limit(1)
    )[0],
  );
}

export async function snapshotIsWritable(
  transaction: Transaction,
  scope: InteractionMemoScope,
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
            eq(eventInteractionNoteSnapshots.targetSource, "self_reported"),
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

export async function targetParticipantNumberIfAllowed(
  transaction: Transaction,
  scope: InteractionMemoScope,
  targetParticipantId: string,
) {
  if (scope.participantId === targetParticipantId) return null;
  const rows = await transaction
    .select({
      id: participants.id,
      participantNumber: participants.participantNumber,
      participantCategory: applications.participantCategory,
    })
    .from(participants)
    .innerJoin(
      checkins,
      and(
        eq(checkins.tenantId, participants.tenantId),
        eq(checkins.eventId, participants.eventId),
        eq(checkins.participantId, participants.id),
        eq(checkins.status, "checked_in"),
      ),
    )
    .innerJoin(
      applications,
      and(
        eq(applications.tenantId, participants.tenantId),
        eq(applications.eventId, participants.eventId),
        eq(applications.id, participants.applicationId),
      ),
    )
    .where(
      and(
        eq(participants.tenantId, scope.tenantId),
        eq(participants.eventId, scope.eventId),
        inArray(participants.id, [scope.participantId, targetParticipantId]),
        inArray(participants.status, ["confirmed", "attended"]),
        isNotNull(participants.participantNumber),
      ),
    );
  if (new Set(rows.map((row) => row.id)).size !== 2) return null;
  if (new Set(rows.map((row) => row.participantCategory)).size !== 2) return null;
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
              eq(participantAvoidances.avoidedParticipantId, targetParticipantId),
            ),
            and(
              eq(participantAvoidances.participantId, targetParticipantId),
              eq(participantAvoidances.avoidedParticipantId, scope.participantId),
            ),
          ),
        ),
      )
      .limit(1)
  )[0];
  return avoidance ? null : (rows.find((row) => row.id === targetParticipantId)?.participantNumber ?? null);
}

export async function findSelfReportedSlot(transaction: Transaction, scope: InteractionMemoScope, sourceRef: string) {
  return (
    await transaction
      .select({ id: interactionSlots.id, status: interactionSlots.status })
      .from(interactionSlots)
      .where(
        and(
          eq(interactionSlots.tenantId, scope.tenantId),
          eq(interactionSlots.eventId, scope.eventId),
          eq(interactionSlots.serviceType, scope.serviceType),
          eq(interactionSlots.source, "self_reported"),
          eq(interactionSlots.sourceRef, sourceRef),
        ),
      )
      .limit(1)
  )[0];
}

export async function slotHasNotes(transaction: Transaction, scope: InteractionMemoScope, interactionSlotId: string) {
  return Boolean(
    (
      await transaction
        .select({ id: interactionNotes.id })
        .from(interactionNotes)
        .where(
          and(
            eq(interactionNotes.tenantId, scope.tenantId),
            eq(interactionNotes.eventId, scope.eventId),
            eq(interactionNotes.serviceType, scope.serviceType),
            eq(interactionNotes.interactionSlotId, interactionSlotId),
          ),
        )
        .limit(1)
    )[0],
  );
}

export async function writeSlotAudit(
  transaction: Transaction,
  scope: InteractionMemoAuditScope,
  interactionSlotId: string,
  action: string,
) {
  await transaction.insert(auditLogs).values({
    tenantId: scope.tenantId,
    actorUserId: scope.actorUserId,
    eventId: scope.eventId,
    action,
    targetType: "interaction_slot",
    targetId: interactionSlotId,
    requestId: scope.requestId,
  });
}
