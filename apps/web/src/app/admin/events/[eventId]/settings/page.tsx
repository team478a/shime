import { and, eq } from "drizzle-orm";
import { hasPermission } from "@shime/core";
import { events, getDatabase } from "@shime/db";
import { notFound, redirect } from "next/navigation";
import { getStaffSession } from "../../../../../server/auth";
import { getEventConfigurationReadiness } from "../../../../../server/event-settings";
import { EventSettingsForm } from "../../event-settings-form";

export default async function EventSettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  if (!hasPermission(session.role, "event:write")) redirect("/admin");
  const { eventId } = await params;
  if (session.eventId && session.eventId !== eventId) notFound();
  const rows = await getDatabase().select().from(events).where(and(eq(events.tenantId, session.tenantId), eq(events.id, eventId))).limit(1);
  const event = rows[0];
  if (!event) notFound();
  const initial = {
    ...event,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    applicationOpensAt: event.applicationOpensAt?.toISOString() ?? null,
    applicationClosesAt: event.applicationClosesAt?.toISOString() ?? null,
    preferenceOpensAt: event.preferenceOpensAt?.toISOString() ?? null,
    preferenceClosesAt: event.preferenceClosesAt?.toISOString() ?? null,
  };
  const configuration = await getEventConfigurationReadiness(session.tenantId, eventId, event);
  return <main><section className="panel settings-panel"><p className="eyebrow">EVENT SETTINGS</p><h1>イベント基本設定</h1><EventSettingsForm mode="edit" initial={initial} configuration={configuration} canDelete={hasPermission(session.role, "event:delete")} /></section></main>;
}
