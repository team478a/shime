import { notFound } from "next/navigation";
import { ApplicationForm } from "./application-form";
import { and, asc, eq } from "drizzle-orm";
import { eventFormFields, events, getDatabase, legalDocuments } from "@shime/db";
import { getLineClientConfig } from "../../../server/line-client-config";
import { buildPublicApplicationFields } from "../../../lib/application-form";
export default async function ApplyPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const db = getDatabase();
  const rows = await db
    .select({
      name: events.name,
      startsAt: events.startsAt,
      venueName: events.venueName,
      venueAddress: events.venueAddress,
      capacity: events.capacity,
      settings: events.settings,
      tenantId: events.tenantId,
    })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.status, "accepting")))
    .limit(1);
  const event = rows[0];
  if (!event) notFound();
  const eventTerms = event.settings.eventTermsVersion;
  const privacy = event.settings.privacyVersion;
  const categorySource = event.settings.participantCategories;
  const participantCategories = Array.isArray(categorySource) ? categorySource.flatMap((category) => {
    if (!category || typeof category !== "object") return [];
    const item = category as Record<string, unknown>;
    return typeof item.code === "string" && typeof item.label === "string" ? [{ code: item.code, label: item.label }] : [];
  }) : [];
  if (typeof eventTerms !== "string" || typeof privacy !== "string" || !event.venueName || !event.venueAddress || participantCategories.length < 2) notFound();
  const documents = await db.select({ documentType: legalDocuments.documentType, version: legalDocuments.version }).from(legalDocuments).where(and(
    eq(legalDocuments.tenantId, event.tenantId),
    eq(legalDocuments.eventId, eventId),
    eq(legalDocuments.status, "published"),
  ));
  if (!documents.some((document) => document.documentType === "event_terms" && document.version === eventTerms) || !documents.some((document) => document.documentType === "privacy" && document.version === privacy)) notFound();
  const storedFields = await db.select({
    fieldKey: eventFormFields.fieldKey,
    label: eventFormFields.label,
    type: eventFormFields.type,
    requirement: eventFormFields.requirement,
    displayOrder: eventFormFields.displayOrder,
    validation: eventFormFields.validation,
  }).from(eventFormFields).where(and(eq(eventFormFields.tenantId, event.tenantId), eq(eventFormFields.eventId, eventId))).orderBy(asc(eventFormFields.displayOrder));
  const lineConfig = await getLineClientConfig(event.tenantId);
  return (
    <main>
      <ApplicationForm
        eventId={eventId}
        eventName={event.name}
        eventSummary={{
          startsAt: event.startsAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long", timeStyle: "short" }),
          venueName: event.venueName,
          venueAddress: event.venueAddress,
          capacity: event.capacity,
        }}
        fields={buildPublicApplicationFields(storedFields, participantCategories)}
        liffId={lineConfig.liffId}
        consentVersions={{ eventTerms, privacy }}
      />
    </main>
  );
}
