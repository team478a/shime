import { and, asc, eq, ilike, inArray, isNotNull, or } from "drizzle-orm";
import {
  checkins,
  getDatabase,
  interactionSlotParticipants,
  interactionSlots,
  participantAvoidances,
  participants,
} from "@shime/db";
import type { CancelSelfReportedSlotRepositoryResult, CreateSelfReportedSlotRepositoryResult } from "./repository";
import {
  findSelfReportedSlot,
  participantIsCheckedIn,
  slotHasNotes,
  snapshotIsWritable,
  targetParticipantNumberIfAllowed,
  writeSlotAudit,
} from "./drizzle-self-reported-helpers";
import type { InteractionMemoAuditScope, InteractionMemoScope, InteractionMemoSnapshot } from "./types";
import type { InteractionMemoTargetCandidate } from "./types";

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");
const sourceRefFor = (firstParticipantId: string, secondParticipantId: string) =>
  `self:${[firstParticipantId, secondParticipantId].sort().join(":")}`;

export async function searchSelfReportedCandidatesWithDrizzle(
  scope: InteractionMemoScope,
  participantNumberPrefix: string,
  limit: number,
): Promise<InteractionMemoTargetCandidate[]> {
  if (!(await participantIsCheckedIn(scope, scope.participantId))) return [];
  const [rows, avoidances] = await Promise.all([
    getDatabase()
      .select({
        targetParticipantId: participants.id,
        participantNumber: participants.participantNumber,
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
      .where(
        and(
          eq(participants.tenantId, scope.tenantId),
          eq(participants.eventId, scope.eventId),
          inArray(participants.status, ["confirmed", "attended"]),
          isNotNull(participants.participantNumber),
          ilike(participants.participantNumber, `${escapeLike(participantNumberPrefix)}%`),
        ),
      )
      .orderBy(asc(participants.participantNumber))
      .limit(limit),
    getDatabase()
      .select({
        participantId: participantAvoidances.participantId,
        avoidedParticipantId: participantAvoidances.avoidedParticipantId,
      })
      .from(participantAvoidances)
      .where(
        and(
          eq(participantAvoidances.tenantId, scope.tenantId),
          eq(participantAvoidances.eventId, scope.eventId),
          or(
            eq(participantAvoidances.participantId, scope.participantId),
            eq(participantAvoidances.avoidedParticipantId, scope.participantId),
          ),
        ),
      ),
  ]);
  const blocked = new Set([
    scope.participantId,
    ...avoidances.map((item) =>
      item.participantId === scope.participantId ? item.avoidedParticipantId : item.participantId,
    ),
  ]);
  return rows.filter(
    (row): row is InteractionMemoTargetCandidate =>
      Boolean(row.participantNumber?.trim()) && !blocked.has(row.targetParticipantId),
  );
}

export async function createSelfReportedSlotWithDrizzle(
  scope: InteractionMemoAuditScope,
  snapshot: InteractionMemoSnapshot,
  targetParticipantId: string,
  now: Date,
): Promise<CreateSelfReportedSlotRepositoryResult> {
  return getDatabase().transaction(async (transaction) => {
    if (!(await snapshotIsWritable(transaction, scope, snapshot.id, now))) return { status: "closed" };
    const participantNumber = await targetParticipantNumberIfAllowed(transaction, scope, targetParticipantId);
    if (!participantNumber) return { status: "invalid_target" };

    const sourceRef = sourceRefFor(scope.participantId, targetParticipantId);
    let slot = await findSelfReportedSlot(transaction, scope, sourceRef);
    let changed = false;
    if (!slot) {
      const insertedSlot = (
        await transaction
          .insert(interactionSlots)
          .values({
            tenantId: scope.tenantId,
            eventId: scope.eventId,
            serviceType: scope.serviceType,
            source: "self_reported",
            sourceRef,
            status: "active",
          })
          .onConflictDoNothing()
          .returning({ id: interactionSlots.id, status: interactionSlots.status })
      )[0];
      slot = insertedSlot ?? (await findSelfReportedSlot(transaction, scope, sourceRef));
      changed = Boolean(insertedSlot);
    } else if (slot.status === "cancelled") {
      if (await slotHasNotes(transaction, scope, slot.id)) return { status: "invalid_target" };
      slot = (
        await transaction
          .update(interactionSlots)
          .set({ status: "active", updatedAt: now })
          .where(
            and(
              eq(interactionSlots.tenantId, scope.tenantId),
              eq(interactionSlots.eventId, scope.eventId),
              eq(interactionSlots.serviceType, scope.serviceType),
              eq(interactionSlots.id, slot.id),
              eq(interactionSlots.status, "cancelled"),
            ),
          )
          .returning({ id: interactionSlots.id, status: interactionSlots.status })
      )[0];
      changed = Boolean(slot);
    }
    if (!slot || slot.status !== "active") return { status: "invalid_target" };

    await transaction
      .insert(interactionSlotParticipants)
      .values(
        [scope.participantId, targetParticipantId].map((participantId) => ({
          tenantId: scope.tenantId,
          eventId: scope.eventId,
          serviceType: scope.serviceType,
          interactionSlotId: slot!.id,
          participantId,
        })),
      )
      .onConflictDoNothing();
    if (changed) await writeSlotAudit(transaction, scope, slot.id, "interaction_slot.self_reported_created");

    return {
      status: changed ? "created" : "existing",
      target: {
        interactionSlotId: slot.id,
        targetParticipantId,
        participantNumber,
        roundNo: null,
      },
    };
  });
}

export async function cancelSelfReportedSlotWithDrizzle(
  scope: InteractionMemoAuditScope,
  snapshot: InteractionMemoSnapshot,
  interactionSlotId: string,
  targetParticipantId: string,
  now: Date,
): Promise<CancelSelfReportedSlotRepositoryResult> {
  return getDatabase().transaction(async (transaction) => {
    if (!(await snapshotIsWritable(transaction, scope, snapshot.id, now))) return { status: "closed" };
    const slot = (
      await transaction
        .select({ id: interactionSlots.id })
        .from(interactionSlots)
        .where(
          and(
            eq(interactionSlots.tenantId, scope.tenantId),
            eq(interactionSlots.eventId, scope.eventId),
            eq(interactionSlots.serviceType, scope.serviceType),
            eq(interactionSlots.id, interactionSlotId),
            eq(interactionSlots.source, "self_reported"),
            eq(interactionSlots.status, "active"),
          ),
        )
        .limit(1)
    )[0];
    if (!slot) return { status: "invalid_target" };
    const memberships = await transaction
      .select({ participantId: interactionSlotParticipants.participantId })
      .from(interactionSlotParticipants)
      .where(
        and(
          eq(interactionSlotParticipants.tenantId, scope.tenantId),
          eq(interactionSlotParticipants.eventId, scope.eventId),
          eq(interactionSlotParticipants.serviceType, scope.serviceType),
          eq(interactionSlotParticipants.interactionSlotId, interactionSlotId),
          inArray(interactionSlotParticipants.participantId, [scope.participantId, targetParticipantId]),
        ),
      );
    if (new Set(memberships.map((row) => row.participantId)).size !== 2) return { status: "invalid_target" };
    if (await slotHasNotes(transaction, scope, interactionSlotId)) return { status: "has_notes" };

    const cancelledSlot = (
      await transaction
        .update(interactionSlots)
        .set({ status: "cancelled", updatedAt: now })
        .where(
          and(
            eq(interactionSlots.tenantId, scope.tenantId),
            eq(interactionSlots.eventId, scope.eventId),
            eq(interactionSlots.serviceType, scope.serviceType),
            eq(interactionSlots.id, interactionSlotId),
            eq(interactionSlots.status, "active"),
          ),
        )
        .returning({ id: interactionSlots.id })
    )[0];
    if (!cancelledSlot) return { status: "invalid_target" };
    await writeSlotAudit(transaction, scope, interactionSlotId, "interaction_slot.self_reported_cancelled");
    return { status: "cancelled" };
  });
}
