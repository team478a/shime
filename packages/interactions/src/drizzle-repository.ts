import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import {
  eventInteractionNoteSnapshots,
  getDatabase,
  interactionNoteOptions,
  interactionNotes,
  interactionSlotParticipants,
  interactionSlots,
  participantAvoidances,
  participants,
} from "@shime/db";
import type { InteractionMemoRepository } from "./repository";
import { interactionPublicProfileFieldKeysSchema, interactionTargetSourceSchema } from "./types";
import { saveOwnNoteWithDrizzle } from "./drizzle-save";
import { getTargetPublicProfileSourceWithDrizzle } from "./drizzle-profile";
import {
  cancelSelfReportedSlotWithDrizzle,
  createSelfReportedSlotWithDrizzle,
  searchSelfReportedCandidatesWithDrizzle,
} from "./drizzle-self-reported";

export function createDrizzleInteractionMemoRepository(): InteractionMemoRepository {
  return {
    async isParticipantEligible(scope) {
      return Boolean(
        (
          await getDatabase()
            .select({ id: participants.id })
            .from(participants)
            .where(
              and(
                eq(participants.tenantId, scope.tenantId),
                eq(participants.eventId, scope.eventId),
                eq(participants.id, scope.participantId),
                inArray(participants.status, ["confirmed", "attended"]),
              ),
            )
            .limit(1)
        )[0],
      );
    },

    async findActiveSnapshot(scope, now) {
      const row = (
        await getDatabase()
          .select({
            id: eventInteractionNoteSnapshots.id,
            version: eventInteractionNoteSnapshots.version,
            targetSource: eventInteractionNoteSnapshots.targetSource,
            publicProfileFieldKeys: eventInteractionNoteSnapshots.publicProfileFieldKeys,
            editableUntil: eventInteractionNoteSnapshots.editableUntil,
          })
          .from(eventInteractionNoteSnapshots)
          .where(
            and(
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
          .orderBy(desc(eventInteractionNoteSnapshots.version))
          .limit(1)
      )[0];
      return row
        ? {
            ...row,
            targetSource: interactionTargetSourceSchema.parse(row.targetSource),
            publicProfileFieldKeys: interactionPublicProfileFieldKeysSchema.parse(row.publicProfileFieldKeys),
          }
        : null;
    },

    async listOptions(scope, snapshotId) {
      const rows = await getDatabase()
        .select({
          code: interactionNoteOptions.code,
          label: interactionNoteOptions.label,
          displayOrder: interactionNoteOptions.displayOrder,
          isNegative: interactionNoteOptions.isNegative,
        })
        .from(interactionNoteOptions)
        .where(
          and(
            eq(interactionNoteOptions.tenantId, scope.tenantId),
            eq(interactionNoteOptions.eventId, scope.eventId),
            eq(interactionNoteOptions.serviceType, scope.serviceType),
            eq(interactionNoteOptions.snapshotId, snapshotId),
            eq(interactionNoteOptions.enabled, true),
          ),
        )
        .orderBy(asc(interactionNoteOptions.displayOrder));
      return rows;
    },

    async listTargets(scope) {
      const actorSlots = await getDatabase()
        .select({ id: interactionSlots.id, roundNo: interactionSlots.roundNo })
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
        .where(
          and(
            eq(interactionSlotParticipants.tenantId, scope.tenantId),
            eq(interactionSlotParticipants.eventId, scope.eventId),
            eq(interactionSlotParticipants.serviceType, scope.serviceType),
            eq(interactionSlotParticipants.participantId, scope.participantId),
            eq(interactionSlots.status, "active"),
          ),
        );
      if (actorSlots.length === 0) return [];

      const slotIds = actorSlots.map((slot) => slot.id);
      const [targetRows, avoidances] = await Promise.all([
        getDatabase()
          .select({
            interactionSlotId: interactionSlotParticipants.interactionSlotId,
            targetParticipantId: interactionSlotParticipants.participantId,
            participantNumber: participants.participantNumber,
          })
          .from(interactionSlotParticipants)
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
              inArray(interactionSlotParticipants.interactionSlotId, slotIds),
              ne(interactionSlotParticipants.participantId, scope.participantId),
              inArray(participants.status, ["confirmed", "attended"]),
              isNotNull(participants.participantNumber),
            ),
          ),
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
      const blocked = new Set(
        avoidances.map((item) =>
          item.participantId === scope.participantId ? item.avoidedParticipantId : item.participantId,
        ),
      );
      const roundBySlot = new Map(actorSlots.map((slot) => [slot.id, slot.roundNo]));
      return targetRows
        .filter((target) => !blocked.has(target.targetParticipantId))
        .map((target) => ({ ...target, roundNo: roundBySlot.get(target.interactionSlotId) ?? null }));
    },

    async listOwnNotes(scope, snapshotId) {
      const rows = await getDatabase()
        .select({
          id: interactionNotes.id,
          interactionSlotId: interactionNotes.interactionSlotId,
          targetParticipantId: interactionNotes.targetParticipantId,
          feelingCode: interactionNotes.feelingCode,
          favorite: interactionNotes.favorite,
          privateNoteText: interactionNotes.privateNoteText,
          wantsToTalkMore: interactionNotes.wantsToTalkMore,
          revision: interactionNotes.revision,
          savedAt: interactionNotes.recordedAt,
        })
        .from(interactionNotes)
        .where(
          and(
            eq(interactionNotes.tenantId, scope.tenantId),
            eq(interactionNotes.eventId, scope.eventId),
            eq(interactionNotes.serviceType, scope.serviceType),
            eq(interactionNotes.snapshotId, snapshotId),
            eq(interactionNotes.actorParticipantId, scope.participantId),
          ),
        );
      return rows.map((row) => ({ ...row, privateNoteText: row.privateNoteText ?? "" }));
    },

    async listOwnWantsToTalkMoreTargetIds(scope) {
      const rows = await getDatabase()
        .select({ targetParticipantId: interactionNotes.targetParticipantId })
        .from(interactionNotes)
        .where(
          and(
            eq(interactionNotes.tenantId, scope.tenantId),
            eq(interactionNotes.eventId, scope.eventId),
            eq(interactionNotes.serviceType, scope.serviceType),
            eq(interactionNotes.actorParticipantId, scope.participantId),
            eq(interactionNotes.wantsToTalkMore, true),
          ),
        );
      return [...new Set(rows.map((row) => row.targetParticipantId))];
    },

    async getTargetPublicProfileSource(scope, targetParticipantId) {
      return getTargetPublicProfileSourceWithDrizzle(scope, targetParticipantId);
    },

    async saveOwnNote(scope, snapshot, input, now) {
      return saveOwnNoteWithDrizzle(scope, snapshot, input, now);
    },

    async searchSelfReportedCandidates(scope, participantNumberPrefix, limit) {
      return searchSelfReportedCandidatesWithDrizzle(scope, participantNumberPrefix, limit);
    },

    async createSelfReportedSlot(scope, snapshot, targetParticipantId, now) {
      return createSelfReportedSlotWithDrizzle(scope, snapshot, targetParticipantId, now);
    },

    async cancelSelfReportedSlot(scope, snapshot, interactionSlotId, targetParticipantId, now) {
      return cancelSelfReportedSlotWithDrizzle(scope, snapshot, interactionSlotId, targetParticipantId, now);
    },
  };
}
