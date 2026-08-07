import { and, eq } from "drizzle-orm";
import { hasPermission } from "@shime/core";
import { events, getDatabase } from "@shime/db";
import { notFound, redirect } from "next/navigation";
import { getStaffSession } from "@shime/web/server/auth";
import { InteractionMemoSettings } from "./interaction-memo-settings";

export default async function InteractionMemoSettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  if (!hasPermission(session.role, "event:write", session.permissions)) redirect("/admin");
  const { eventId } = await params;
  if (session.eventId && session.eventId !== eventId) notFound();
  const event = (
    await getDatabase()
      .select({ id: events.id, name: events.name })
      .from(events)
      .where(and(eq(events.tenantId, session.tenantId), eq(events.id, eventId)))
      .limit(1)
  )[0];
  if (!event) notFound();
  return (
    <main>
      <InteractionMemoSettings
        eventId={eventId}
        eventName={event.name}
        canPublish={hasPermission(session.role, "concierge:publish", session.permissions)}
      />
    </main>
  );
}
