import { and, eq, isNull, or } from "drizzle-orm";
import {
  eventMatchChatConfigs,
  events,
  getDatabase,
  matchCandidates,
  matchChatBlocks,
  matchChatConsents,
  matchChatReports,
  matchChatRooms,
  resultConfirmations,
} from "@shime/db";
import type { MatchChatSafetyRepository } from "./repository";
import { matchChatConfigSchema, type MatchChatRoom } from "./types";
import { listEncryptedMessages, saveEncryptedMessage } from "./drizzle-message-repository";

const roomSelection = {
  id: matchChatRooms.id,
  matchCandidateId: matchChatRooms.matchCandidateId,
  participantAId: matchChatRooms.participantAId,
  participantBId: matchChatRooms.participantBId,
  status: matchChatRooms.status,
  opensAt: matchChatRooms.opensAt,
  closesAt: matchChatRooms.closesAt,
};

function asRoom(row: typeof matchChatRooms.$inferSelect): MatchChatRoom;
function asRoom(row: {
  id: string;
  matchCandidateId: string;
  participantAId: string;
  participantBId: string;
  status: "pending_consent" | "open" | "blocked" | "closed";
  opensAt: Date | null;
  closesAt: Date;
}): MatchChatRoom;
function asRoom(row: MatchChatRoom): MatchChatRoom {
  return row;
}

export function createDrizzleMatchChatSafetyRepository(): MatchChatSafetyRepository {
  return {
    async findConfig(scope) {
      const row = (
        await getDatabase()
          .select({
            enabled: eventMatchChatConfigs.enabled,
            windowHours: eventMatchChatConfigs.windowHours,
            messagesPerMinute: eventMatchChatConfigs.messagesPerMinute,
            maxMessageLength: eventMatchChatConfigs.maxMessageLength,
            termsVersion: eventMatchChatConfigs.termsVersion,
            retentionDays: eventMatchChatConfigs.retentionDays,
          })
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
      return row ? matchChatConfigSchema.parse(row) : null;
    },

    async findEligibility(scope, matchCandidateId) {
      const candidate = (
        await getDatabase()
          .select({
            matchCandidateId: matchCandidates.id,
            participantAId: matchCandidates.participantAId,
            participantBId: matchCandidates.participantBId,
            resultPublishedAt: events.resultPublishAt,
          })
          .from(matchCandidates)
          .innerJoin(events, and(eq(events.tenantId, matchCandidates.tenantId), eq(events.id, matchCandidates.eventId)))
          .where(
            and(
              eq(matchCandidates.tenantId, scope.tenantId),
              eq(matchCandidates.eventId, scope.eventId),
              eq(matchCandidates.id, matchCandidateId),
              eq(matchCandidates.status, "approved"),
              eq(events.status, "result_confirmed"),
              or(
                eq(matchCandidates.participantAId, scope.participantId),
                eq(matchCandidates.participantBId, scope.participantId),
              ),
            ),
          )
          .limit(1)
      )[0];
      const resultPublishedAt = candidate?.resultPublishedAt;
      if (!candidate || !resultPublishedAt) return null;
      const confirmation = (
        await getDatabase()
          .select({ id: resultConfirmations.id })
          .from(resultConfirmations)
          .where(
            and(
              eq(resultConfirmations.tenantId, scope.tenantId),
              eq(resultConfirmations.eventId, scope.eventId),
              isNull(resultConfirmations.revokedAt),
            ),
          )
          .limit(1)
      )[0];
      return { ...candidate, resultPublishedAt, resultConfirmationActive: Boolean(confirmation) };
    },

    async findRoom(scope, matchCandidateId) {
      const row = (
        await getDatabase()
          .select(roomSelection)
          .from(matchChatRooms)
          .where(
            and(
              eq(matchChatRooms.tenantId, scope.tenantId),
              eq(matchChatRooms.eventId, scope.eventId),
              eq(matchChatRooms.serviceType, scope.serviceType),
              eq(matchChatRooms.matchCandidateId, matchCandidateId),
            ),
          )
          .limit(1)
      )[0];
      return row ? asRoom(row) : null;
    },

    async createRoom(scope, eligibility, closesAt, now) {
      await getDatabase()
        .insert(matchChatRooms)
        .values({
          tenantId: scope.tenantId,
          eventId: scope.eventId,
          serviceType: scope.serviceType,
          matchCandidateId: eligibility.matchCandidateId,
          participantAId: eligibility.participantAId,
          participantBId: eligibility.participantBId,
          closesAt,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
      const room = await this.findRoom(scope, eligibility.matchCandidateId);
      if (!room) throw new Error("MATCH_CHAT_ROOM_CREATE_FAILED");
      return room;
    },

    async findAccessContext(scope, roomId) {
      const room = (
        await getDatabase()
          .select(roomSelection)
          .from(matchChatRooms)
          .where(
            and(
              eq(matchChatRooms.tenantId, scope.tenantId),
              eq(matchChatRooms.eventId, scope.eventId),
              eq(matchChatRooms.serviceType, scope.serviceType),
              eq(matchChatRooms.id, roomId),
              or(
                eq(matchChatRooms.participantAId, scope.participantId),
                eq(matchChatRooms.participantBId, scope.participantId),
              ),
            ),
          )
          .limit(1)
      )[0];
      if (!room) return null;
      const [config, eligibility] = await Promise.all([
        this.findConfig(scope),
        this.findEligibility(scope, room.matchCandidateId),
      ]);
      if (!config) return null;
      return {
        config,
        room: asRoom(room),
        eligibilityActive: Boolean(eligibility?.resultConfirmationActive),
      };
    },

    async acceptConsent(scope, roomId, termsVersion, now) {
      await getDatabase()
        .insert(matchChatConsents)
        .values({
          tenantId: scope.tenantId,
          eventId: scope.eventId,
          roomId,
          participantId: scope.participantId,
          termsVersion,
          acceptedAt: now,
        })
        .onConflictDoUpdate({
          target: [matchChatConsents.roomId, matchChatConsents.participantId],
          set: { termsVersion, acceptedAt: now, revokedAt: null, updatedAt: now },
        });
    },

    async listActiveConsentParticipantIds(scope, roomId) {
      return (
        await getDatabase()
          .select({ participantId: matchChatConsents.participantId })
          .from(matchChatConsents)
          .where(
            and(
              eq(matchChatConsents.tenantId, scope.tenantId),
              eq(matchChatConsents.eventId, scope.eventId),
              eq(matchChatConsents.roomId, roomId),
              isNull(matchChatConsents.revokedAt),
            ),
          )
      ).map((row) => row.participantId);
    },

    async openRoom(scope, roomId, now) {
      const row = (
        await getDatabase()
          .update(matchChatRooms)
          .set({ status: "open", opensAt: now, updatedAt: now })
          .where(
            and(
              eq(matchChatRooms.tenantId, scope.tenantId),
              eq(matchChatRooms.eventId, scope.eventId),
              eq(matchChatRooms.id, roomId),
              eq(matchChatRooms.status, "pending_consent"),
            ),
          )
          .returning(roomSelection)
      )[0];
      if (row) return asRoom(row);
      const current = (
        await getDatabase()
          .select(roomSelection)
          .from(matchChatRooms)
          .where(
            and(
              eq(matchChatRooms.tenantId, scope.tenantId),
              eq(matchChatRooms.eventId, scope.eventId),
              eq(matchChatRooms.id, roomId),
            ),
          )
          .limit(1)
      )[0];
      if (!current) throw new Error("MATCH_CHAT_ROOM_NOT_FOUND");
      return asRoom(current);
    },

    async blockRoom(scope, roomId, blockedParticipantId, now) {
      await getDatabase().transaction(async (tx) => {
        await tx
          .insert(matchChatBlocks)
          .values({
            tenantId: scope.tenantId,
            eventId: scope.eventId,
            roomId,
            blockerParticipantId: scope.participantId,
            blockedParticipantId,
            createdAt: now,
          })
          .onConflictDoNothing();
        await tx
          .update(matchChatRooms)
          .set({ status: "blocked", blockedAt: now, updatedAt: now })
          .where(
            and(
              eq(matchChatRooms.tenantId, scope.tenantId),
              eq(matchChatRooms.eventId, scope.eventId),
              eq(matchChatRooms.id, roomId),
            ),
          );
      });
    },

    async createReport(scope, roomId, reportedParticipantId, input, now) {
      await getDatabase().insert(matchChatReports).values({
        tenantId: scope.tenantId,
        eventId: scope.eventId,
        roomId,
        reporterParticipantId: scope.participantId,
        reportedParticipantId,
        category: input.category,
        detail: input.detail,
        createdAt: now,
        updatedAt: now,
      });
    },

    saveEncryptedMessage,
    listEncryptedMessages,
  };
}
