import { and, desc, eq } from "drizzle-orm";
import { hasPermission } from "@shime/core";
import { events, getDatabase, legalDocuments } from "@shime/db";
import { notFound, redirect } from "next/navigation";
import { getStaffSession } from "../../../../../server/auth";
import { LegalDocumentConsole } from "./legal-document-console";

export default async function LegalDocumentsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  if (!hasPermission(session.role, "event:write")) redirect("/admin");
  const { eventId } = await params;
  if (session.eventId && session.eventId !== eventId) notFound();
  const db = getDatabase();
  const event = (
    await db
      .select({ id: events.id, name: events.name })
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId)))
      .limit(1)
  )[0];
  if (!event) notFound();
  const documents = await db
    .select()
    .from(legalDocuments)
    .where(and(eq(legalDocuments.tenantId, session.tenantId), eq(legalDocuments.eventId, eventId)))
    .orderBy(desc(legalDocuments.createdAt));
  return (
    <main>
      <LegalDocumentConsole
        key={documents.map((document) => `${document.id}:${document.updatedAt.toISOString()}`).join("|")}
        eventId={eventId}
        eventName={event.name}
        initial={documents.map((document) => ({
          ...document,
          publishedAt: document.publishedAt?.toISOString() ?? null,
          createdAt: document.createdAt.toISOString(),
          updatedAt: document.updatedAt.toISOString(),
        }))}
      />
    </main>
  );
}
