import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { allocateParticipantNumber, getParticipantNumberPrefix, isDreamRequirementSatisfied } from "@shime/core";
import {
  applications,
  eventQuestionnaires,
  events,
  getDatabase,
  lovePassports,
  participants,
  questionnaireResponses,
} from "@shime/db";
import { participantHandler } from "@shime/web/server/api/participant-handler";

export const POST = participantHandler(
  async (_request: Request, { params }: { params: Promise<{ eventId: string }> }) => (await params).eventId,
  async ({ eventId, participant, session }) => {
    const db = getDatabase();
    const details = await db
      .select({
        mode: events.dreamRegistrationMode,
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
    if (!isDreamRequirementSatisfied(detail.mode, participant.dreamState))
      return NextResponse.json({ code: "DREAM_REQUIREMENT_NOT_SATISFIED" }, { status: 409 });
    const questionnaire = await db
      .select()
      .from(eventQuestionnaires)
      .where(and(eq(eventQuestionnaires.tenantId, session.tenantId), eq(eventQuestionnaires.eventId, eventId)))
      .limit(1);
    if (!questionnaire[0]) return NextResponse.json({ code: "QUESTIONNAIRE_NOT_CONFIGURED" }, { status: 409 });
    const response = await db
      .select()
      .from(questionnaireResponses)
      .where(
        and(
          eq(questionnaireResponses.tenantId, session.tenantId),
          eq(questionnaireResponses.eventId, eventId),
          eq(questionnaireResponses.participantId, participant.id),
          eq(questionnaireResponses.versionId, questionnaire[0].versionId),
          eq(questionnaireResponses.status, "submitted"),
        ),
      )
      .limit(1);
    if (!response[0]) return NextResponse.json({ code: "QUESTIONNAIRE_NOT_SUBMITTED" }, { status: 409 });
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
              status: "ready",
              readyAt: now,
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
      },
    });
  },
);
