import { and, eq } from "drizzle-orm";
import { evaluatePassportPreparation, getEventSeatingMode } from "@shime/core";
import { conciergeSessions, eventQuestionnaires, events, getDatabase, questionnaireResponses } from "@shime/db";
import { getParticipantJourneySettings } from "./event-journey-use-cases";

export async function loadPassportPreparation(input: {
  tenantId: string;
  eventId: string;
  participantId: string;
  dreamState: "not_started" | "drafting" | "confirmed" | "skipped";
}) {
  const db = getDatabase();
  const [event, journey] = await Promise.all([
    db
      .select({ dreamMode: events.dreamRegistrationMode, settings: events.settings })
      .from(events)
      .where(and(eq(events.tenantId, input.tenantId), eq(events.id, input.eventId)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getParticipantJourneySettings.execute({ tenantId: input.tenantId, eventId: input.eventId }),
  ]);
  if (!event || !journey) return null;

  const effectiveSteps = journey.effectiveSteps.filter(
    (step) => getEventSeatingMode(event.settings) === "assigned" || step.id !== "questionnaire",
  );
  const questionnaireStep = effectiveSteps.find((step) => step.id === "questionnaire")?.enabled === true;
  const diagnosisStep = effectiveSteps.find((step) => step.id === "diagnosis")?.enabled === true;
  const [questionnaireSubmitted, diagnosisSubmitted] = await Promise.all([
    questionnaireStep
      ? db
          .select({ id: questionnaireResponses.id })
          .from(questionnaireResponses)
          .innerJoin(
            eventQuestionnaires,
            and(
              eq(eventQuestionnaires.tenantId, questionnaireResponses.tenantId),
              eq(eventQuestionnaires.eventId, questionnaireResponses.eventId),
              eq(eventQuestionnaires.versionId, questionnaireResponses.versionId),
            ),
          )
          .where(
            and(
              eq(questionnaireResponses.tenantId, input.tenantId),
              eq(questionnaireResponses.eventId, input.eventId),
              eq(questionnaireResponses.participantId, input.participantId),
              eq(questionnaireResponses.status, "submitted"),
            ),
          )
          .limit(1)
          .then((rows) => rows.length > 0)
      : Promise.resolve(true),
    diagnosisStep
      ? db
          .select({ id: conciergeSessions.id })
          .from(conciergeSessions)
          .where(
            and(
              eq(conciergeSessions.tenantId, input.tenantId),
              eq(conciergeSessions.eventId, input.eventId),
              eq(conciergeSessions.participantId, input.participantId),
              eq(conciergeSessions.status, "submitted"),
            ),
          )
          .limit(1)
          .then((rows) => rows.length > 0)
      : Promise.resolve(true),
  ]);

  return evaluatePassportPreparation({
    steps: effectiveSteps,
    dreamMode: event.dreamMode,
    dreamState: input.dreamState,
    questionnaireSubmitted,
    diagnosisSubmitted,
  });
}
