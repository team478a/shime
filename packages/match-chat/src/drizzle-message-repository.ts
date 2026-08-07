import { and, asc, count, eq, gt, isNull } from "drizzle-orm";
import { getDatabase, matchChatMessages, matchChatRooms } from "@shime/db";
import type { MatchChatSafetyRepository } from "./repository";

export const saveEncryptedMessage: MatchChatSafetyRepository["saveEncryptedMessage"] = async (scope, roomId, input) =>
  getDatabase().transaction(async (tx) => {
    const room = (
      await tx
        .select({
          participantAId: matchChatRooms.participantAId,
          participantBId: matchChatRooms.participantBId,
          status: matchChatRooms.status,
          closesAt: matchChatRooms.closesAt,
        })
        .from(matchChatRooms)
        .where(
          and(
            eq(matchChatRooms.tenantId, scope.tenantId),
            eq(matchChatRooms.eventId, scope.eventId),
            eq(matchChatRooms.id, roomId),
          ),
        )
        .limit(1)
        .for("update")
    )[0];
    if (
      !room ||
      room.status !== "open" ||
      input.sentAt >= room.closesAt ||
      ![room.participantAId, room.participantBId].includes(scope.participantId)
    )
      return { status: "not_available" };
    const existing = (
      await tx
        .select()
        .from(matchChatMessages)
        .where(
          and(
            eq(matchChatMessages.tenantId, scope.tenantId),
            eq(matchChatMessages.eventId, scope.eventId),
            eq(matchChatMessages.roomId, roomId),
            eq(matchChatMessages.senderParticipantId, scope.participantId),
            eq(matchChatMessages.clientMessageId, input.clientMessageId),
          ),
        )
        .limit(1)
    )[0];
    if (existing) return { status: "idempotent", message: existing };
    const recent = (
      await tx
        .select({ value: count() })
        .from(matchChatMessages)
        .where(
          and(
            eq(matchChatMessages.tenantId, scope.tenantId),
            eq(matchChatMessages.eventId, scope.eventId),
            eq(matchChatMessages.roomId, roomId),
            eq(matchChatMessages.senderParticipantId, scope.participantId),
            gt(matchChatMessages.sentAt, new Date(input.sentAt.getTime() - 60_000)),
            isNull(matchChatMessages.deletedAt),
          ),
        )
    )[0]?.value;
    if ((recent ?? 0) >= input.messagesPerMinute) return { status: "rate_limited" };
    const saved = (
      await tx
        .insert(matchChatMessages)
        .values({
          tenantId: scope.tenantId,
          eventId: scope.eventId,
          roomId,
          senderParticipantId: scope.participantId,
          clientMessageId: input.clientMessageId,
          encryptedBody: input.encryptedBody,
          encryptionVersion: input.encryptionVersion,
          sentAt: input.sentAt,
          expiresAt: input.expiresAt,
          createdAt: input.sentAt,
        })
        .returning()
    )[0];
    if (!saved) throw new Error("MATCH_CHAT_MESSAGE_SAVE_FAILED");
    return { status: "saved", message: saved };
  });

export const listEncryptedMessages: MatchChatSafetyRepository["listEncryptedMessages"] = (scope, roomId, now, limit) =>
  getDatabase()
    .select({
      id: matchChatMessages.id,
      senderParticipantId: matchChatMessages.senderParticipantId,
      clientMessageId: matchChatMessages.clientMessageId,
      encryptedBody: matchChatMessages.encryptedBody,
      encryptionVersion: matchChatMessages.encryptionVersion,
      sentAt: matchChatMessages.sentAt,
      expiresAt: matchChatMessages.expiresAt,
    })
    .from(matchChatMessages)
    .where(
      and(
        eq(matchChatMessages.tenantId, scope.tenantId),
        eq(matchChatMessages.eventId, scope.eventId),
        eq(matchChatMessages.roomId, roomId),
        gt(matchChatMessages.expiresAt, now),
        isNull(matchChatMessages.deletedAt),
      ),
    )
    .orderBy(asc(matchChatMessages.sentAt), asc(matchChatMessages.id))
    .limit(limit);
