import { z } from "zod";

import { SEATING_AXES } from "../seating/score";

export const EVENT_CONFIGURATION_MODULE_KEY = "event_operations";
export const EVENT_CONFIGURATION_SCHEMA_VERSION = 1;
export const APPLICATION_FORM_TEMPLATE_TYPE = "application_form";
export const QUESTIONNAIRE_TEMPLATE_TYPE = "questionnaire";

export const applicationFormFieldTemplateSchema = z.object({
  fieldKey: z.string().regex(/^[a-z0-9_]{2,80}$/),
  label: z.string().trim().min(1).max(160),
  type: z.enum(["text", "email", "tel", "date", "select", "checkbox"]),
  requirement: z.enum(["required", "optional", "hidden"]),
  displayOrder: z.number().int().min(1),
  validation: z.record(z.string(), z.unknown()).default({}),
});

export const applicationFormTemplatePayloadSchema = z.object({
  schemaVersion: z.literal(EVENT_CONFIGURATION_SCHEMA_VERSION),
  fields: z.array(applicationFormFieldTemplateSchema).min(1).max(100),
});

const questionnaireOptionTemplateSchema = z.object({
  code: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(200),
  scoreValue: z.number().int().nullable(),
});

export const questionnaireQuestionTemplateSchema = z.object({
  axis: z.enum(SEATING_AXES),
  prompt: z.string().trim().min(1).max(300),
  kind: z.enum(["multi_select", "ordinal", "complement"]),
  maxSelections: z.number().int().min(1).max(10),
  weight: z.number().int().min(1).max(100),
  options: z.array(questionnaireOptionTemplateSchema).min(2).max(30),
});

export const questionnaireTemplatePayloadSchema = z
  .object({
    schemaVersion: z.literal(EVENT_CONFIGURATION_SCHEMA_VERSION),
    code: z.string().regex(/^[a-z0-9_-]{2,80}$/),
    name: z.string().trim().min(1).max(160),
    questions: z.array(questionnaireQuestionTemplateSchema).length(5),
  })
  .superRefine((value, context) => {
    if (new Set(value.questions.map((question) => question.axis)).size !== 5)
      context.addIssue({ code: "custom", message: "Five unique axes are required" });
    if (value.questions.reduce((sum, question) => sum + question.weight, 0) !== 100)
      context.addIssue({ code: "custom", message: "Weights must total 100" });
  });

export const eventConfigurationTemplateInputSchema = z.discriminatedUnion("templateType", [
  z.object({
    templateType: z.literal(APPLICATION_FORM_TEMPLATE_TYPE),
    name: z.string().trim().min(1).max(160),
    payload: applicationFormTemplatePayloadSchema,
  }),
  z.object({
    templateType: z.literal(QUESTIONNAIRE_TEMPLATE_TYPE),
    name: z.string().trim().min(1).max(160),
    payload: questionnaireTemplatePayloadSchema,
  }),
]);

export function canonicalizeEventConfigurationPayload(payload: unknown): string {
  return JSON.stringify(payload);
}

export function nextEventConfigurationTemplateVersion(currentVersion?: number): number {
  if (currentVersion === undefined) return 1;
  if (!Number.isInteger(currentVersion) || currentVersion < 1)
    throw new Error("Invalid event configuration template version");
  return currentVersion + 1;
}
