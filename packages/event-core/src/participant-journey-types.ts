import { z } from "zod";

export const participantJourneyStepIdSchema = z.enum(["dream", "questionnaire", "diagnosis", "pass"]);

export type ParticipantJourneyStepId = z.infer<typeof participantJourneyStepIdSchema>;

export const participantJourneyStepsSchema = z
  .array(
    z.object({
      id: participantJourneyStepIdSchema,
      enabled: z.boolean(),
    }),
  )
  .length(4)
  .superRefine((steps, context) => {
    const ids = steps.map((step) => step.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        message: "Journey steps must be unique",
      });
    }
    for (const id of participantJourneyStepIdSchema.options) {
      if (!ids.includes(id)) {
        context.addIssue({
          code: "custom",
          message: `Journey step ${id} is required`,
        });
      }
    }
    if (!steps.find((step) => step.id === "pass")?.enabled) {
      context.addIssue({
        code: "custom",
        message: "PASS must remain enabled",
      });
    }
    const passIndex = ids.indexOf("pass");
    for (const prerequisite of ["dream", "questionnaire"] as const) {
      const index = ids.indexOf(prerequisite);
      if (steps[index]?.enabled && index > passIndex) {
        context.addIssue({
          code: "custom",
          message: `${prerequisite} must be completed before PASS`,
        });
      }
    }
  });

export type ParticipantJourneyStep = z.infer<typeof participantJourneyStepsSchema>[number];

export const DEFAULT_PARTICIPANT_JOURNEY: ParticipantJourneyStep[] = [
  { id: "dream", enabled: true },
  { id: "questionnaire", enabled: true },
  { id: "pass", enabled: true },
  { id: "diagnosis", enabled: false },
];

export type ParticipantJourneyVersion = {
  id: string;
  version: number;
  status: "draft" | "published" | "archived";
  steps: ParticipantJourneyStep[];
  publishedAt: Date | null;
  updatedAt: Date;
};

export type ParticipantJourneySettings = {
  draft: ParticipantJourneyVersion | null;
  published: ParticipantJourneyVersion | null;
  effectiveSteps: ParticipantJourneyStep[];
};
