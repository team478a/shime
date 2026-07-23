import { and, desc, eq } from "drizzle-orm";
import { hasPermission } from "@shime/core";
import { conciergeTemplates, conciergeTemplateVersions, eventConciergeSnapshots, events, getDatabase } from "@shime/db";
import { redirect } from "next/navigation";
import { getStaffSession } from "../../../../../server/auth";
import { EventConciergeSettings } from "./event-concierge-settings";

export default async function EventConciergePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  if (!hasPermission(session.role, "concierge:manage") || (session.eventId && session.eventId !== eventId)) redirect("/admin");
  const db = getDatabase();
  const event = (await db.select({ id: events.id, name: events.name }).from(events).where(and(
    eq(events.id, eventId), eq(events.tenantId, session.tenantId),
  )).limit(1))[0];
  if (!event) redirect("/admin");
  const versions = await db.select().from(conciergeTemplateVersions).where(and(
    eq(conciergeTemplateVersions.tenantId, session.tenantId),
    eq(conciergeTemplateVersions.status, "published"),
  )).orderBy(desc(conciergeTemplateVersions.publishedAt));
  const templateIds = [...new Set(versions.map((version) => version.templateId))];
  const templates = templateIds.length ? await db.select({ id: conciergeTemplates.id, name: conciergeTemplates.name }).from(conciergeTemplates).where(
    eq(conciergeTemplates.tenantId, session.tenantId),
  ) : [];
  const names = new Map(templates.map((template) => [template.id, template.name]));
  const current = (await db.select().from(eventConciergeSnapshots).where(and(
    eq(eventConciergeSnapshots.tenantId, session.tenantId),
    eq(eventConciergeSnapshots.eventId, eventId),
  )).limit(1))[0];
  return <main><EventConciergeSettings eventId={eventId} eventName={event.name} current={current ? {
    templateVersionId: current.templateVersionId,
    templateVersion: current.templateVersion,
    snapshotHash: current.snapshotHash,
    enabled: current.enabled,
  } : null} versions={versions.map((version) => ({
    id: version.id,
    version: version.version,
    name: names.get(version.templateId) ?? "名称不明",
  }))} /></main>;
}
