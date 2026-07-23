import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createCsv, requirePermission, type CsvValue } from "@shime/core";
import {
  applications,
  auditLogs,
  checkins,
  eventSeats,
  eventTables,
  events,
  getDatabase,
  lovePassports,
  matchCandidates,
  participants,
  preferences,
  preferenceSubmissions,
  questionnaireResponses,
  seatAssignments,
  seatingRuns,
} from "@shime/db";
import { requireStaffSession } from "@shime/web/server/auth";
const typeSchema = z.enum(["participants", "checkins", "seats", "progress", "results", "preferences"]);
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string; exportType: string }> }) {
  const { eventId, exportType: rawType } = await params;
  const type = typeSchema.safeParse(rawType);
  if (!type.success) return NextResponse.json({ code: "INVALID_EXPORT_TYPE" }, { status: 404 });
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try {
    requirePermission(session.role, type.data === "preferences" ? "backup:sensitive" : "backup:export");
  } catch {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }
  const db = getDatabase();
  const eventRows = await db
    .select({ id: events.id, code: events.code })
    .from(events)
    .where(and(eq(events.tenantId, session.tenantId), eq(events.id, eventId)))
    .limit(1);
  const event = eventRows[0];
  if (!event) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  let headers: string[] = [];
  let rows: CsvValue[][] = [];
  if (type.data === "participants") {
    headers = [
      "participant_number",
      "full_name",
      "full_name_kana",
      "nickname",
      "category",
      "application_source",
      "participant_status",
      "line_linked",
      "dream_status",
    ];
    const data = await db
      .select({
        number: participants.participantNumber,
        name: applications.fullName,
        kana: applications.fullNameKana,
        nickname: applications.nickname,
        category: applications.participantCategory,
        source: applications.source,
        status: participants.status,
        userId: participants.userId,
        dreamState: participants.dreamState,
      })
      .from(participants)
      .innerJoin(
        applications,
        and(eq(applications.id, participants.applicationId), eq(applications.tenantId, participants.tenantId)),
      )
      .where(and(eq(participants.tenantId, session.tenantId), eq(participants.eventId, eventId)));
    rows = data.map((r) => [
      r.number,
      r.name,
      r.kana,
      r.nickname,
      r.category,
      r.source,
      r.status,
      Boolean(r.userId),
      r.dreamState,
    ]);
  }
  if (type.data === "checkins") {
    headers = ["participant_number", "status", "method", "checked_in_at", "cancelled_at", "cancellation_reason"];
    const data = await db
      .select({
        number: participants.participantNumber,
        status: checkins.status,
        method: checkins.method,
        checkedInAt: checkins.checkedInAt,
        cancelledAt: checkins.cancelledAt,
        reason: checkins.cancellationReason,
      })
      .from(checkins)
      .innerJoin(
        participants,
        and(
          eq(participants.id, checkins.participantId),
          eq(participants.tenantId, checkins.tenantId),
          eq(participants.eventId, checkins.eventId),
        ),
      )
      .where(and(eq(checkins.tenantId, session.tenantId), eq(checkins.eventId, eventId)));
    rows = data.map((r) => [r.number, r.status, r.method, r.checkedInAt, r.cancelledAt, r.reason]);
  }
  if (type.data === "seats") {
    headers = ["participant_number", "table_code", "seat_code", "locked", "published_at"];
    const data = await db
      .select({
        number: participants.participantNumber,
        tableCode: eventTables.tableCode,
        seatCode: eventSeats.seatCode,
        locked: seatAssignments.locked,
        publishedAt: seatAssignments.publishedAt,
      })
      .from(seatAssignments)
      .innerJoin(
        seatingRuns,
        and(
          eq(seatingRuns.id, seatAssignments.seatingRunId),
          eq(seatingRuns.tenantId, seatAssignments.tenantId),
          eq(seatingRuns.status, "published"),
        ),
      )
      .innerJoin(
        participants,
        and(eq(participants.id, seatAssignments.participantId), eq(participants.tenantId, seatAssignments.tenantId)),
      )
      .innerJoin(
        eventSeats,
        and(eq(eventSeats.id, seatAssignments.seatId), eq(eventSeats.tenantId, seatAssignments.tenantId)),
      )
      .innerJoin(
        eventTables,
        and(eq(eventTables.id, eventSeats.tableId), eq(eventTables.tenantId, eventSeats.tenantId)),
      )
      .where(and(eq(seatAssignments.tenantId, session.tenantId), eq(seatAssignments.eventId, eventId)));
    rows = data.map((r) => [r.number, r.tableCode, r.seatCode, r.locked, r.publishedAt]);
  }
  if (type.data === "progress") {
    headers = [
      "participant_number",
      "line_linked",
      "dream_status",
      "questionnaire_status",
      "passport_status",
      "checkin_status",
      "preference_status",
    ];
    const data = await db
      .select({
        number: participants.participantNumber,
        userId: participants.userId,
        dreamState: participants.dreamState,
        questionnaire: questionnaireResponses.status,
        passport: lovePassports.status,
        checkin: checkins.status,
        preference: preferenceSubmissions.status,
      })
      .from(participants)
      .leftJoin(
        questionnaireResponses,
        and(
          eq(questionnaireResponses.tenantId, participants.tenantId),
          eq(questionnaireResponses.eventId, participants.eventId),
          eq(questionnaireResponses.participantId, participants.id),
        ),
      )
      .leftJoin(
        lovePassports,
        and(
          eq(lovePassports.tenantId, participants.tenantId),
          eq(lovePassports.eventId, participants.eventId),
          eq(lovePassports.participantId, participants.id),
        ),
      )
      .leftJoin(
        checkins,
        and(
          eq(checkins.tenantId, participants.tenantId),
          eq(checkins.eventId, participants.eventId),
          eq(checkins.participantId, participants.id),
        ),
      )
      .leftJoin(
        preferenceSubmissions,
        and(
          eq(preferenceSubmissions.tenantId, participants.tenantId),
          eq(preferenceSubmissions.eventId, participants.eventId),
          eq(preferenceSubmissions.participantId, participants.id),
        ),
      )
      .where(and(eq(participants.tenantId, session.tenantId), eq(participants.eventId, eventId)));
    rows = data.map((r) => [
      r.number,
      Boolean(r.userId),
      r.dreamState,
      r.questionnaire,
      r.passport,
      r.checkin,
      r.preference,
    ]);
  }
  if (type.data === "results") {
    headers = ["participant_a_number", "participant_b_number", "status", "decided_at", "decision_reason"];
    const a = participants;
    const data = await db
      .select({
        aId: matchCandidates.participantAId,
        bId: matchCandidates.participantBId,
        status: matchCandidates.status,
        decidedAt: matchCandidates.decidedAt,
        reason: matchCandidates.decisionReason,
      })
      .from(matchCandidates)
      .where(and(eq(matchCandidates.tenantId, session.tenantId), eq(matchCandidates.eventId, eventId)));
    const people = await db
      .select({ id: a.id, number: a.participantNumber })
      .from(a)
      .where(and(eq(a.tenantId, session.tenantId), eq(a.eventId, eventId)));
    const number = new Map(people.map((p) => [p.id, p.number]));
    rows = data.map((r) => [number.get(r.aId), number.get(r.bId), r.status, r.decidedAt, r.reason]);
  }
  if (type.data === "preferences") {
    headers = [
      "from_participant_number",
      "to_participant_number",
      "rank",
      "private_note",
      "submission_status",
      "submitted_at",
    ];
    const data = await db
      .select({
        fromId: preferences.fromParticipantId,
        toId: preferences.toParticipantId,
        rank: preferences.rank,
        note: preferences.privateNote,
        status: preferenceSubmissions.status,
        submittedAt: preferenceSubmissions.submittedAt,
      })
      .from(preferences)
      .innerJoin(
        preferenceSubmissions,
        and(
          eq(preferenceSubmissions.id, preferences.submissionId),
          eq(preferenceSubmissions.tenantId, preferences.tenantId),
        ),
      )
      .where(and(eq(preferences.tenantId, session.tenantId), eq(preferences.eventId, eventId)));
    const people = await db
      .select({ id: participants.id, number: participants.participantNumber })
      .from(participants)
      .where(and(eq(participants.tenantId, session.tenantId), eq(participants.eventId, eventId)));
    const number = new Map(people.map((p) => [p.id, p.number]));
    rows = data.map((r) => [number.get(r.fromId), number.get(r.toId), r.rank, r.note, r.status, r.submittedAt]);
  }
  await db.insert(auditLogs).values({
    tenantId: session.tenantId,
    actorUserId: session.userId,
    eventId,
    action: "backup.export",
    targetType: "event",
    targetId: eventId,
    after: { exportType: type.data, rowCount: rows.length },
    requestId: randomUUID(),
  });
  const csv = createCsv(headers, rows);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${event.code}-${type.data}.csv"`,
      "cache-control": "no-store",
    },
  });
}
