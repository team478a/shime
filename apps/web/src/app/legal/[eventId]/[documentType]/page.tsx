import { and, desc, eq } from "drizzle-orm";
import { events, getDatabase, legalDocuments } from "@shime/db";
import { notFound } from "next/navigation";
import { isLegalDocumentType } from "../../../../server/legal-documents";

export default async function LegalDocumentPage({ params, searchParams }: { params: Promise<{ eventId: string; documentType: string }>; searchParams: Promise<{ version?: string }> }) {
  const { eventId, documentType } = await params; const { version } = await searchParams; if (!isLegalDocumentType(documentType)) notFound();
  const db = getDatabase(); const event = (await db.select({ id: events.id, tenantId: events.tenantId, name: events.name }).from(events).where(eq(events.id, eventId)).limit(1))[0]; if (!event) notFound();
  const conditions = [eq(legalDocuments.tenantId, event.tenantId), eq(legalDocuments.eventId, eventId), eq(legalDocuments.documentType, documentType), eq(legalDocuments.status, "published")]; if (version) conditions.push(eq(legalDocuments.version, version));
  const document = (await db.select().from(legalDocuments).where(and(...conditions)).orderBy(desc(legalDocuments.publishedAt)).limit(1))[0]; if (!document) notFound();
  const publishedAt = document.publishedAt?.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long", timeStyle: "short" });
  return <main><article className="panel legal-document"><p className="eyebrow">{event.name}</p><h1>{document.title}</h1><p className="legal-meta">版: {document.version}{publishedAt ? ` / 公開: ${publishedAt}` : ""}</p><div className="legal-body">{document.body}</div></article></main>;
}
