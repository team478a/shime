import { and, eq, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validatePreferenceChoices } from "@shime/core";
import {
  checkins,
  conversationPairs,
  events,
  getDatabase,
  participantAvoidances,
  participants,
  preferenceSubmissions,
  preferences,
} from "@shime/db";
import { requireParticipantForEvent } from "@shime/web/server/participant-auth";
const input = z.object({
  choices: z.array(
    z.object({
      participantId: z.string().uuid(),
      rank: z.number().int().nullable().optional(),
      privateNote: z.string().max(1000).nullable().optional(),
    }),
  ),
});
export async function PUT(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await requireParticipantForEvent(eventId).catch(() => null);
  if (!auth) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  const choices = parsed.data.choices.map((choice) => ({
    participantId: choice.participantId,
    rank: choice.rank ?? null,
    privateNote: choice.privateNote ?? null,
  }));
  const db = getDatabase();
  const event = await db
    .select()
    .from(events)
    .where(and(eq(events.tenantId, auth.session.tenantId), eq(events.id, eventId)))
    .limit(1);
  if (!event[0]) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  const now = new Date();
  if (
    event[0].status !== "preference_open" ||
    (event[0].preferenceOpensAt && event[0].preferenceOpensAt > now) ||
    (event[0].preferenceClosesAt && event[0].preferenceClosesAt <= now)
  )
    return NextResponse.json({ code: "PREFERENCE_NOT_OPEN" }, { status: 409 });
  try {
    validatePreferenceChoices(event[0].preferenceMode, choices);
  } catch (error) {
    return NextResponse.json({ code: error instanceof Error ? error.message : "INVALID_CHOICES" }, { status: 400 });
  }
  const pairs = await db
    .select()
    .from(conversationPairs)
    .where(
      and(
        eq(conversationPairs.tenantId, auth.session.tenantId),
        eq(conversationPairs.eventId, eventId),
        or(
          eq(conversationPairs.participantAId, auth.participant.id),
          eq(conversationPairs.participantBId, auth.participant.id),
        ),
      ),
    );
  const conversationIds = new Set(
    pairs.map((p) => (p.participantAId === auth.participant.id ? p.participantBId : p.participantAId)),
  );
  const avoidances = await db
    .select()
    .from(participantAvoidances)
    .where(
      and(
        eq(participantAvoidances.tenantId, auth.session.tenantId),
        eq(participantAvoidances.eventId, eventId),
        or(
          eq(participantAvoidances.participantId, auth.participant.id),
          eq(participantAvoidances.avoidedParticipantId, auth.participant.id),
        ),
      ),
    );
  const blocked = new Set(
    avoidances.map((a) => (a.participantId === auth.participant.id ? a.avoidedParticipantId : a.participantId)),
  );
  const choiceIds = choices.map((c) => c.participantId);
  const checked = choiceIds.length
    ? await db
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
            eq(participants.tenantId, auth.session.tenantId),
            eq(participants.eventId, eventId),
            inArray(participants.id, choiceIds),
          ),
        )
    : [];
  const checkedSet = new Set(checked.map((p) => p.id));
  if (
    choiceIds.some(
      (id) => id === auth.participant.id || !conversationIds.has(id) || blocked.has(id) || !checkedSet.has(id),
    )
  )
    return NextResponse.json({ code: "INVALID_CANDIDATE" }, { status: 400 });
  const existing = await db
    .select()
    .from(preferenceSubmissions)
    .where(
      and(
        eq(preferenceSubmissions.tenantId, auth.session.tenantId),
        eq(preferenceSubmissions.eventId, eventId),
        eq(preferenceSubmissions.participantId, auth.participant.id),
      ),
    )
    .limit(1);
  const submission = await db.transaction(async (tx) => {
    const [saved] = existing[0]
      ? await tx
          .update(preferenceSubmissions)
          .set({ status: "draft", submittedAt: null, updatedAt: now })
          .where(eq(preferenceSubmissions.id, existing[0].id))
          .returning()
      : await tx
          .insert(preferenceSubmissions)
          .values({ tenantId: auth.session.tenantId, eventId, participantId: auth.participant.id, status: "draft" })
          .returning();
    if (!saved) throw new Error("PREFERENCE_SAVE_FAILED");
    await tx
      .delete(preferences)
      .where(
        and(
          eq(preferences.tenantId, auth.session.tenantId),
          eq(preferences.eventId, eventId),
          eq(preferences.fromParticipantId, auth.participant.id),
        ),
      );
    if (choices.length)
      await tx.insert(preferences).values(
        choices.map((choice) => ({
          tenantId: auth.session.tenantId,
          eventId,
          submissionId: saved.id,
          fromParticipantId: auth.participant.id,
          toParticipantId: choice.participantId,
          rank: choice.rank,
          privateNote: choice.privateNote,
        })),
      );
    return saved;
  });
  return NextResponse.json({ data: { id: submission.id, status: submission.status } });
}
