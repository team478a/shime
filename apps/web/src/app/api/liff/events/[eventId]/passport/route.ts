import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { allocateParticipantNumber, canIssuePassportForParticipant, getParticipantNumberPrefix } from "@shime/core";
import { applications, events, getDatabase, lovePassports, participants } from "@shime/db";
import { participantHandler } from "@shime/web/server/api/participant-handler";
import { loadPassportPreparation } from "@shime/web/server/passport-preparation";

export const POST = participantHandler(
  async (_request: Request, { params }: { params: Promise<{ eventId: string }> }) => (await params).eventId,
  async ({ eventId, participant, session }) => {
    if (!canIssuePassportForParticipant(participant.status)) {
      return NextResponse.json({ code: "PARTICIPATION_NOT_CONFIRMED" }, { status: 409 });
    }
    const db = getDatabase();
    const details = await db
      .select({
        settings: events.settings,
        category: applications.participantCategory,
      })
      .from(events)
      .innerJoin(
        applications,
        and(eq(applications.id, participant.applicationId), eq(applications.tenantId, events.tenantId)),
      )
      .where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId)))
      .limit(1);
    const detail = details[0];
    if (!detail) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
    const preparation = await loadPassportPreparation({
      tenantId: session.tenantId,
      eventId,
      participantId: participant.id,
      dreamState: participant.dreamState,
    });
    if (!preparation) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
    const numberConfig = detail.settings.participantNumber as
      { prefixes?: Record<string, string>; groupAPrefix?: string; groupBPrefix?: string; digits?: number } | undefined;
    const prefix = getParticipantNumberPrefix(numberConfig, detail.category);
    const digits = numberConfig?.digits;
    if (!prefix || typeof digits !== "number")
      return NextResponse.json({ code: "PARTICIPANT_NUMBER_NOT_CONFIGURED" }, { status: 409 });
    const now = new Date();
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select id from events where id = ${eventId} and tenant_id = ${session.tenantId} for update`);
      const current = await tx
        .select({ participantNumber: participants.participantNumber })
        .from(participants)
        .where(and(eq(participants.tenantId, session.tenantId), eq(participants.eventId, eventId)));
      const participantNumber =
        participant.participantNumber ??
        allocateParticipantNumber(
          prefix,
          digits,
          current.map((item) => item.participantNumber),
        );
      if (!participant.participantNumber)
        await tx
          .update(participants)
          .set({ participantNumber, updatedAt: now })
          .where(
            and(
              eq(participants.id, participant.id),
              eq(participants.tenantId, session.tenantId),
              eq(participants.eventId, eventId),
            ),
          );
      const existing = await tx
        .select()
        .from(lovePassports)
        .where(
          and(
            eq(lovePassports.tenantId, session.tenantId),
            eq(lovePassports.eventId, eventId),
            eq(lovePassports.participantId, participant.id),
          ),
        )
        .limit(1);
      const passport =
        existing[0] ??
        (
          await tx
            .insert(lovePassports)
            .values({
              tenantId: session.tenantId,
              eventId,
              participantId: participant.id,
              status: preparation.complete ? "ready" : "issued",
              readyAt: preparation.complete ? now : null,
            })
            .returning()
        )[0];
      return { passport, participantNumber };
    });
    return NextResponse.json({
      data: {
        passportId: result.passport?.id,
        status: result.passport?.status,
        participantNumber: result.participantNumber,
        preparation,
      },
    });
  },
);
