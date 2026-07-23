import { and, asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  eventQuestionnaires,
  getDatabase,
  questionnaireAnswers,
  questionnaireOptions,
  questionnaireQuestions,
  questionnaireResponses,
} from "@shime/db";
import { requireParticipantForEvent } from "@shime/web/server/participant-auth";
const bodySchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      optionCodes: z.array(z.string()).default([]),
      declined: z.boolean().default(false),
    }),
  ),
});
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await requireParticipantForEvent(eventId).catch(() => null);
  if (!auth) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const db = getDatabase();
  const configured = await db
    .select()
    .from(eventQuestionnaires)
    .where(and(eq(eventQuestionnaires.tenantId, auth.session.tenantId), eq(eventQuestionnaires.eventId, eventId)))
    .limit(1);
  if (!configured[0]) return NextResponse.json({ code: "QUESTIONNAIRE_NOT_CONFIGURED" }, { status: 409 });
  const questions = await db
    .select()
    .from(questionnaireQuestions)
    .where(
      and(
        eq(questionnaireQuestions.tenantId, auth.session.tenantId),
        eq(questionnaireQuestions.versionId, configured[0].versionId),
      ),
    )
    .orderBy(asc(questionnaireQuestions.displayOrder));
  const options = questions.length
    ? await db
        .select()
        .from(questionnaireOptions)
        .where(
          and(
            eq(questionnaireOptions.tenantId, auth.session.tenantId),
            inArray(
              questionnaireOptions.questionId,
              questions.map((q) => q.id),
            ),
          ),
        )
        .orderBy(asc(questionnaireOptions.displayOrder))
    : [];
  const response = await db
    .select()
    .from(questionnaireResponses)
    .where(
      and(
        eq(questionnaireResponses.tenantId, auth.session.tenantId),
        eq(questionnaireResponses.eventId, eventId),
        eq(questionnaireResponses.participantId, auth.participant.id),
      ),
    )
    .limit(1);
  const answers = response[0]
    ? await db
        .select()
        .from(questionnaireAnswers)
        .where(
          and(
            eq(questionnaireAnswers.tenantId, auth.session.tenantId),
            eq(questionnaireAnswers.responseId, response[0].id),
          ),
        )
    : [];
  return NextResponse.json({
    data: {
      versionId: configured[0].versionId,
      status: response[0]?.status ?? "draft",
      questions: questions.map((q) => ({ ...q, options: options.filter((o) => o.questionId === q.id) })),
      answers,
    },
  });
}
export async function PUT(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const auth = await requireParticipantForEvent(eventId).catch(() => null);
  if (!auth) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  const db = getDatabase();
  const configured = await db
    .select()
    .from(eventQuestionnaires)
    .where(and(eq(eventQuestionnaires.tenantId, auth.session.tenantId), eq(eventQuestionnaires.eventId, eventId)))
    .limit(1);
  if (!configured[0]) return NextResponse.json({ code: "QUESTIONNAIRE_NOT_CONFIGURED" }, { status: 409 });
  const validQuestions = await db
    .select()
    .from(questionnaireQuestions)
    .where(
      and(
        eq(questionnaireQuestions.tenantId, auth.session.tenantId),
        eq(questionnaireQuestions.versionId, configured[0].versionId),
      ),
    );
  const valid = new Map(validQuestions.map((q) => [q.id, q]));
  const validOptions = validQuestions.length
    ? await db
        .select()
        .from(questionnaireOptions)
        .where(
          and(
            eq(questionnaireOptions.tenantId, auth.session.tenantId),
            inArray(
              questionnaireOptions.questionId,
              validQuestions.map((q) => q.id),
            ),
          ),
        )
    : [];
  const optionSet = new Set(validOptions.map((o) => `${o.questionId}:${o.code}`));
  if (
    parsed.data.answers.some(
      (a) =>
        !valid.has(a.questionId) ||
        (!a.declined &&
          (a.optionCodes.length < 1 ||
            a.optionCodes.length > valid.get(a.questionId)!.maxSelections ||
            new Set(a.optionCodes).size !== a.optionCodes.length ||
            a.optionCodes.some((code) => !optionSet.has(`${a.questionId}:${code}`)))),
    )
  )
    return NextResponse.json({ code: "INVALID_ANSWER" }, { status: 400 });
  const existing = await db
    .select()
    .from(questionnaireResponses)
    .where(
      and(
        eq(questionnaireResponses.tenantId, auth.session.tenantId),
        eq(questionnaireResponses.eventId, eventId),
        eq(questionnaireResponses.participantId, auth.participant.id),
      ),
    )
    .limit(1);
  if (existing[0]?.status === "submitted") return NextResponse.json({ code: "ALREADY_SUBMITTED" }, { status: 409 });
  const versionId = configured[0].versionId;
  const saved = await db.transaction(async (tx) => {
    const [response] = existing[0]
      ? existing
      : await tx
          .insert(questionnaireResponses)
          .values({
            tenantId: auth.session.tenantId,
            eventId,
            participantId: auth.participant.id,
            versionId,
            status: "draft",
          })
          .returning();
    for (const answer of parsed.data.answers)
      await tx
        .insert(questionnaireAnswers)
        .values({
          tenantId: auth.session.tenantId,
          eventId,
          responseId: response!.id,
          ...answer,
          optionCodes: answer.declined ? [] : answer.optionCodes,
        })
        .onConflictDoUpdate({
          target: [questionnaireAnswers.tenantId, questionnaireAnswers.responseId, questionnaireAnswers.questionId],
          set: {
            optionCodes: answer.declined ? [] : answer.optionCodes,
            declined: answer.declined,
            updatedAt: new Date(),
          },
        });
    return response;
  });
  return NextResponse.json({ data: saved });
}
