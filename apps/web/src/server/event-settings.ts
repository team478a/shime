import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  evaluateEventConfiguration,
  includeEventOperationalReadiness,
  includeLegalDocumentReadiness,
} from "@shime/core";
import {
  eventDreamSettings,
  eventFormFields,
  eventQuestionnaires,
  eventSeats,
  eventTables,
  getDatabase,
  legalDocuments,
} from "@shime/db";

export const eventSettingsFields = {
  participantCategories: z
    .array(
      z.object({
        code: z
          .string()
          .trim()
          .regex(/^[a-z0-9_-]{1,40}$/),
        label: z.string().trim().min(1).max(80),
      }),
    )
    .min(2)
    .max(20)
    .optional(),
  participantNumber: z
    .object({
      groupAPrefix: z.string().trim().min(1).max(8),
      groupBPrefix: z.string().trim().min(1).max(8),
      digits: z.number().int().min(1).max(6),
    })
    .optional(),
  conversationRounds: z.number().int().min(1).max(20).optional(),
  cardSetCode: z.string().trim().min(1).max(80).optional(),
  retentionDays: z.number().int().min(1).max(3650).optional(),
  eventTermsVersion: z.string().trim().min(1).max(80).optional(),
  privacyVersion: z.string().trim().min(1).max(80).optional(),
  contactExchangeMode: z.enum(["operator_mediated", "mutual_consent_display"]).optional(),
};

export type EventSettingsFields = {
  participantCategories?: Array<{ code: string; label: string }> | undefined;
  participantNumber?: { groupAPrefix: string; groupBPrefix: string; digits: number } | undefined;
  conversationRounds?: number | undefined;
  cardSetCode?: string | undefined;
  retentionDays?: number | undefined;
  eventTermsVersion?: string | undefined;
  privacyVersion?: string | undefined;
  contactExchangeMode?: "operator_mediated" | "mutual_consent_display" | undefined;
};

export function mergeEventSettings(
  current: Record<string, unknown>,
  input: EventSettingsFields,
): Record<string, unknown> {
  const next = { ...current };
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) next[key] = value;
  }
  return next;
}

export function getEventConfigurationStatus(event: {
  name: string;
  startsAt: Date;
  endsAt: Date | null;
  venueName: string | null;
  venueAddress: string | null;
  applicationOpensAt: Date | null;
  applicationClosesAt: Date | null;
  preferenceOpensAt: Date | null;
  preferenceClosesAt: Date | null;
  settings: Record<string, unknown>;
}) {
  return evaluateEventConfiguration(event);
}

export async function getEventConfigurationReadiness(
  tenantId: string,
  eventId: string,
  event: Parameters<typeof getEventConfigurationStatus>[0] & { capacity: number },
) {
  const db = getDatabase();
  const [formFields, tables, seats, dreamSettings, questionnaires, documents] = await Promise.all([
    db
      .select({ fieldKey: eventFormFields.fieldKey, requirement: eventFormFields.requirement })
      .from(eventFormFields)
      .where(and(eq(eventFormFields.tenantId, tenantId), eq(eventFormFields.eventId, eventId))),
    db
      .select({ id: eventTables.id })
      .from(eventTables)
      .where(and(eq(eventTables.tenantId, tenantId), eq(eventTables.eventId, eventId))),
    db
      .select({ id: eventSeats.id })
      .from(eventSeats)
      .where(and(eq(eventSeats.tenantId, tenantId), eq(eventSeats.eventId, eventId), eq(eventSeats.enabled, true))),
    db
      .select({ eventId: eventDreamSettings.eventId })
      .from(eventDreamSettings)
      .where(and(eq(eventDreamSettings.tenantId, tenantId), eq(eventDreamSettings.eventId, eventId)))
      .limit(1),
    db
      .select({ eventId: eventQuestionnaires.eventId })
      .from(eventQuestionnaires)
      .where(and(eq(eventQuestionnaires.tenantId, tenantId), eq(eventQuestionnaires.eventId, eventId)))
      .limit(1),
    db
      .select({ documentType: legalDocuments.documentType, version: legalDocuments.version })
      .from(legalDocuments)
      .where(
        and(
          eq(legalDocuments.tenantId, tenantId),
          eq(legalDocuments.eventId, eventId),
          eq(legalDocuments.status, "published"),
        ),
      ),
  ]);
  const operational = includeEventOperationalReadiness(getEventConfigurationStatus(event), {
    capacity: event.capacity,
    formFields,
    tableCount: tables.length,
    enabledSeatCount: seats.length,
    hasDreamSettings: dreamSettings.length > 0,
    hasQuestionnaire: questionnaires.length > 0,
  });
  return includeLegalDocumentReadiness(operational, {
    hasPublishedEventTerms: documents.some(
      (document) => document.documentType === "event_terms" && document.version === event.settings.eventTermsVersion,
    ),
    hasPublishedPrivacy: documents.some(
      (document) => document.documentType === "privacy" && document.version === event.settings.privacyVersion,
    ),
  });
}
