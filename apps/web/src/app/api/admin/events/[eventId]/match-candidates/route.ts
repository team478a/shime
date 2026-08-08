import { randomUUID } from "node:crypto";
import { and, eq, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canonicalizeMatchPair, findMatchConflicts, requirePermission } from "@shime/core";
import {
  applications,
  auditLogs,
  checkins,
  events,
  getDatabase,
  matchCandidates,
  participants,
  preferenceSubmissions,
} from "@shime/db";
import { requireStaffSession } from "@shime/web/server/auth";

const manualMatchInput = z
  .object({
    participantAId: z.string().uuid(),
    participantBId: z.string().uuid(),
    reason: z.string().trim().min(1).max(500).default("スタッフが口頭希望を確認"),
  })
  .strict();
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try {
    requirePermission(session.role, "preference:read", session.permissions);
  } catch {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }
  const db = getDatabase();
  const event = await db
    .select()
    .from(events)
    .where(and(eq(events.tenantId, session.tenantId), eq(events.id, eventId)))
    .limit(1);
  if (!event[0]) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  const candidates = await db
    .select()
    .from(matchCandidates)
    .where(and(eq(matchCandidates.tenantId, session.tenantId), eq(matchCandidates.eventId, eventId)));
  const people = await db
    .select({
      id: participants.id,
      participantNumber: participants.participantNumber,
      fullName: applications.fullName,
      checkinId: checkins.id,
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
        eq(checkins.status, "checked_in"),
      ),
    )
    .where(and(eq(participants.tenantId, session.tenantId), eq(participants.eventId, eventId)));
  const submissions = await db
    .select()
    .from(preferenceSubmissions)
    .where(and(eq(preferenceSubmissions.tenantId, session.tenantId), eq(preferenceSubmissions.eventId, eventId)));
  return NextResponse.json({
    data: {
      eventName: event[0].name,
      eventStatus: event[0].status,
      preferenceMode: event[0].preferenceMode,
      allowMultipleMatches: event[0].allowMultipleMatches,
      candidates,
      participants: people.map(({ checkinId, ...person }) => ({ ...person, checkedIn: Boolean(checkinId) })),
      submissionSummary: {
        submitted: submissions.filter((s) => s.status === "submitted").length,
        total: people.length,
      },
      conflicts: findMatchConflicts(candidates, event[0].allowMultipleMatches),
    },
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try {
    requirePermission(session.role, "result:confirm", session.permissions);
  } catch {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }
  const parsed = manualMatchInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });

  let pair: ReturnType<typeof canonicalizeMatchPair>;
  try {
    pair = canonicalizeMatchPair(parsed.data.participantAId, parsed.data.participantBId);
  } catch {
    return NextResponse.json({ code: "SAME_PARTICIPANT" }, { status: 400 });
  }

  const db = getDatabase();
  const event = (
    await db
      .select()
      .from(events)
      .where(and(eq(events.tenantId, session.tenantId), eq(events.id, eventId)))
      .limit(1)
  )[0];
  if (!event) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  if (
    ![
      "accepting",
      "registration_closed",
      "checkin_open",
      "in_progress",
      "preference_open",
      "preference_closed",
    ].includes(event.status)
  )
    return NextResponse.json({ code: "INVALID_EVENT_STATE" }, { status: 409 });

  const eligible = await db
    .select({ id: participants.id })
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
        eq(participants.tenantId, session.tenantId),
        eq(participants.eventId, eventId),
        inArray(participants.id, [pair.participantAId, pair.participantBId]),
      ),
    );
  if (new Set(eligible.map((row) => row.id)).size !== 2)
    return NextResponse.json({ code: "PARTICIPANT_NOT_CHECKED_IN" }, { status: 409 });

  const existing = (
    await db
      .select()
      .from(matchCandidates)
      .where(
        and(
          eq(matchCandidates.tenantId, session.tenantId),
          eq(matchCandidates.eventId, eventId),
          or(
            and(
              eq(matchCandidates.participantAId, pair.participantAId),
              eq(matchCandidates.participantBId, pair.participantBId),
            ),
            and(
              eq(matchCandidates.participantAId, pair.participantBId),
              eq(matchCandidates.participantBId, pair.participantAId),
            ),
          ),
        ),
      )
      .limit(1)
  )[0];

  if (!event.allowMultipleMatches) {
    const conflicts = await db
      .select({ id: matchCandidates.id })
      .from(matchCandidates)
      .where(
        and(
          eq(matchCandidates.tenantId, session.tenantId),
          eq(matchCandidates.eventId, eventId),
          eq(matchCandidates.status, "approved"),
          or(
            inArray(matchCandidates.participantAId, [pair.participantAId, pair.participantBId]),
            inArray(matchCandidates.participantBId, [pair.participantAId, pair.participantBId]),
          ),
        ),
      );
    if (conflicts.some((row) => row.id !== existing?.id))
      return NextResponse.json({ code: "MULTIPLE_MATCH_CONFLICT" }, { status: 409 });
  }

  const now = new Date();
  const saved = await db.transaction(async (tx) => {
    const [candidate] = existing
      ? await tx
          .update(matchCandidates)
          .set({
            status: "approved",
            decisionReason: parsed.data.reason,
            decidedBy: session.userId,
            decidedAt: now,
            updatedAt: now,
          })
          .where(eq(matchCandidates.id, existing.id))
          .returning()
      : await tx
          .insert(matchCandidates)
          .values({
            tenantId: session.tenantId,
            eventId,
            ...pair,
            status: "approved",
            decisionReason: parsed.data.reason,
            decidedBy: session.userId,
            decidedAt: now,
          })
          .returning();
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      eventId,
      action: "match_candidate.manual_approve",
      targetType: "match_candidate",
      targetId: candidate!.id,
      before: existing ? { status: existing.status } : undefined,
      after: { status: "approved", source: "staff_manual" },
      reason: parsed.data.reason,
      requestId: randomUUID(),
    });
    return candidate;
  });
  return NextResponse.json({ data: saved }, { status: existing ? 200 : 201 });
}
