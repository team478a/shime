import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

import {
  applications,
  checkins,
  eventSeats,
  eventTables,
  getDatabase,
  participants,
  seatAssignments,
  seatingRuns,
} from "@shime/db";

import type { SeatingRepository } from "./seating-repository";
import {
  seatAssignmentExplanationSchema,
  seatingConfigSnapshotSchema,
  seatingScoreSummarySchema,
  seatingTargetSnapshotSchema,
} from "./seating-types";

export function createDrizzleSeatingRepository(): SeatingRepository {
  return {
    async listRuns(scope) {
      const rows = await getDatabase()
        .select()
        .from(seatingRuns)
        .where(and(eq(seatingRuns.tenantId, scope.tenantId), eq(seatingRuns.eventId, scope.eventId)))
        .orderBy(desc(seatingRuns.createdAt));
      return rows.map((row) => ({
        ...row,
        configSnapshot: seatingConfigSnapshotSchema.parse(row.configSnapshot),
        targetSnapshot: seatingTargetSnapshotSchema.parse(row.targetSnapshot),
        scoreSummary: seatingScoreSummarySchema.parse(row.scoreSummary),
      }));
    },

    async listAssignments(scope, seatingRunIds) {
      const rows = await getDatabase()
        .select()
        .from(seatAssignments)
        .where(
          and(
            eq(seatAssignments.tenantId, scope.tenantId),
            eq(seatAssignments.eventId, scope.eventId),
            inArray(seatAssignments.seatingRunId, seatingRunIds),
          ),
        );
      return rows.map((row) => ({
        ...row,
        explanation: seatAssignmentExplanationSchema.parse(row.explanation),
      }));
    },

    async listParticipants(scope) {
      return getDatabase()
        .select({
          id: participants.id,
          participantNumber: participants.participantNumber,
          fullName: applications.fullName,
          category: applications.participantCategory,
          checkinStatus: checkins.status,
        })
        .from(participants)
        .innerJoin(
          applications,
          and(eq(applications.id, participants.applicationId), eq(applications.tenantId, participants.tenantId)),
        )
        .leftJoin(
          checkins,
          and(
            eq(checkins.tenantId, participants.tenantId),
            eq(checkins.eventId, participants.eventId),
            eq(checkins.participantId, participants.id),
          ),
        )
        .where(and(eq(participants.tenantId, scope.tenantId), eq(participants.eventId, scope.eventId)));
    },

    async listSeats(scope) {
      return getDatabase()
        .select({
          id: eventSeats.id,
          seatCode: eventSeats.seatCode,
          tableCode: eventTables.tableCode,
          enabled: eventSeats.enabled,
        })
        .from(eventSeats)
        .innerJoin(
          eventTables,
          and(
            eq(eventTables.id, eventSeats.tableId),
            eq(eventTables.tenantId, eventSeats.tenantId),
            eq(eventTables.eventId, eventSeats.eventId),
          ),
        )
        .where(and(eq(eventSeats.tenantId, scope.tenantId), eq(eventSeats.eventId, scope.eventId)));
    },

    async getPublishedParticipantSeat(scope, participantId) {
      const row = (
        await getDatabase()
          .select({
            tableCode: eventTables.tableCode,
            seatCode: eventSeats.seatCode,
            explanation: seatAssignments.explanation,
            publishedAt: seatAssignments.publishedAt,
          })
          .from(seatAssignments)
          .innerJoin(
            seatingRuns,
            and(
              eq(seatingRuns.id, seatAssignments.seatingRunId),
              eq(seatingRuns.tenantId, seatAssignments.tenantId),
              eq(seatingRuns.eventId, seatAssignments.eventId),
              eq(seatingRuns.status, "published"),
            ),
          )
          .innerJoin(
            eventSeats,
            and(
              eq(eventSeats.id, seatAssignments.seatId),
              eq(eventSeats.tenantId, seatAssignments.tenantId),
              eq(eventSeats.eventId, seatAssignments.eventId),
            ),
          )
          .innerJoin(
            eventTables,
            and(
              eq(eventTables.id, eventSeats.tableId),
              eq(eventTables.tenantId, seatAssignments.tenantId),
              eq(eventTables.eventId, seatAssignments.eventId),
            ),
          )
          .where(
            and(
              eq(seatAssignments.tenantId, scope.tenantId),
              eq(seatAssignments.eventId, scope.eventId),
              eq(seatAssignments.participantId, participantId),
              isNotNull(seatAssignments.publishedAt),
            ),
          )
          .orderBy(desc(seatAssignments.publishedAt))
          .limit(1)
      )[0];
      if (!row?.publishedAt) return null;
      return {
        ...row,
        explanation: seatAssignmentExplanationSchema.parse(row.explanation),
        publishedAt: row.publishedAt,
      };
    },
  };
}
