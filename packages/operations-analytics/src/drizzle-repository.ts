import { and, eq, sql } from "drizzle-orm";
import { events, getDatabase, interactionNotes, matchChatMessages, matchChatReports, matchChatRooms } from "@shime/db";
import type { OperationsAnalyticsRepository } from "./repository";

const asNumber = (value: unknown) => Number(value ?? 0);

export function createDrizzleOperationsAnalyticsRepository(
  database?: ReturnType<typeof getDatabase>,
): OperationsAnalyticsRepository {
  return {
    async load(scope) {
      const db = database ?? getDatabase();
      const event = (
        await db
          .select({ name: events.name })
          .from(events)
          .where(and(eq(events.tenantId, scope.tenantId), eq(events.id, scope.eventId)))
          .limit(1)
      )[0];
      if (!event) return null;

      const interactionSummary = (
        await db
          .select({
            cohortSize: sql<number>`count(distinct ${interactionNotes.actorParticipantId})`.mapWith(Number),
            memoCount: sql<number>`count(*)`.mapWith(Number),
            favoriteCount: sql<number>`count(*) filter (where ${interactionNotes.favorite} = true)`.mapWith(Number),
            wantsToTalkMoreCount:
              sql<number>`count(*) filter (where ${interactionNotes.wantsToTalkMore} = true)`.mapWith(Number),
          })
          .from(interactionNotes)
          .where(
            and(
              eq(interactionNotes.tenantId, scope.tenantId),
              eq(interactionNotes.eventId, scope.eventId),
              eq(interactionNotes.serviceType, scope.serviceType),
            ),
          )
      )[0];
      const feelings = await db
        .select({ key: interactionNotes.feelingCode, count: sql<number>`count(*)`.mapWith(Number) })
        .from(interactionNotes)
        .where(
          and(
            eq(interactionNotes.tenantId, scope.tenantId),
            eq(interactionNotes.eventId, scope.eventId),
            eq(interactionNotes.serviceType, scope.serviceType),
          ),
        )
        .groupBy(interactionNotes.feelingCode)
        .orderBy(interactionNotes.feelingCode);

      const participantCohort = sql<number>`(
        select count(*)::int from (
          select participant_a_id as participant_id from match_chat_rooms
          where tenant_id = ${scope.tenantId}::uuid and event_id = ${scope.eventId}::uuid
            and service_type = ${scope.serviceType}
          union
          select participant_b_id as participant_id from match_chat_rooms
          where tenant_id = ${scope.tenantId}::uuid and event_id = ${scope.eventId}::uuid
            and service_type = ${scope.serviceType}
        ) anonymous_chat_cohort
      )`.mapWith(Number);
      const chatSummary = (
        await db
          .select({
            cohortSize: participantCohort,
            roomCount: sql<number>`count(*)`.mapWith(Number),
            openRoomCount: sql<number>`count(*) filter (where ${matchChatRooms.status} = 'open')`.mapWith(Number),
            blockedRoomCount: sql<number>`count(*) filter (where ${matchChatRooms.status} = 'blocked')`.mapWith(Number),
          })
          .from(matchChatRooms)
          .where(
            and(
              eq(matchChatRooms.tenantId, scope.tenantId),
              eq(matchChatRooms.eventId, scope.eventId),
              eq(matchChatRooms.serviceType, scope.serviceType),
            ),
          )
      )[0];
      const messageSummary = (
        await db
          .select({
            count: sql<number>`count(*) filter (where ${matchChatMessages.deletedAt} is null)`.mapWith(Number),
          })
          .from(matchChatMessages)
          .innerJoin(
            matchChatRooms,
            and(
              eq(matchChatRooms.tenantId, matchChatMessages.tenantId),
              eq(matchChatRooms.eventId, matchChatMessages.eventId),
              eq(matchChatRooms.id, matchChatMessages.roomId),
            ),
          )
          .where(
            and(
              eq(matchChatMessages.tenantId, scope.tenantId),
              eq(matchChatMessages.eventId, scope.eventId),
              eq(matchChatRooms.serviceType, scope.serviceType),
            ),
          )
      )[0];
      const reportsByStatus = await db
        .select({ key: matchChatReports.status, count: sql<number>`count(*)`.mapWith(Number) })
        .from(matchChatReports)
        .innerJoin(
          matchChatRooms,
          and(
            eq(matchChatRooms.tenantId, matchChatReports.tenantId),
            eq(matchChatRooms.eventId, matchChatReports.eventId),
            eq(matchChatRooms.id, matchChatReports.roomId),
          ),
        )
        .where(
          and(
            eq(matchChatReports.tenantId, scope.tenantId),
            eq(matchChatReports.eventId, scope.eventId),
            eq(matchChatRooms.serviceType, scope.serviceType),
          ),
        )
        .groupBy(matchChatReports.status)
        .orderBy(matchChatReports.status);

      return {
        eventName: event.name,
        interaction: {
          cohortSize: asNumber(interactionSummary?.cohortSize),
          memoCount: asNumber(interactionSummary?.memoCount),
          favoriteCount: asNumber(interactionSummary?.favoriteCount),
          wantsToTalkMoreCount: asNumber(interactionSummary?.wantsToTalkMoreCount),
          feelings,
        },
        matchChat: {
          cohortSize: asNumber(chatSummary?.cohortSize),
          roomCount: asNumber(chatSummary?.roomCount),
          openRoomCount: asNumber(chatSummary?.openRoomCount),
          blockedRoomCount: asNumber(chatSummary?.blockedRoomCount),
          messageCount: asNumber(messageSummary?.count),
          reportCount: reportsByStatus.reduce((total, item) => total + item.count, 0),
          reportsByStatus,
        },
      };
    },
  };
}
