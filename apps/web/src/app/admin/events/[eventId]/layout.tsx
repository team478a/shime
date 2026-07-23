import { and, eq } from "drizzle-orm";
import { events, getDatabase } from "@shime/db";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminEventNavigation } from "../../../../components/admin-navigation";
import { getEventAdminNavigation, STAFF_ROLE_LABELS } from "../../../../lib/admin-navigation";
import { getEventStatusLabel } from "../../../../lib/status-labels";
import { getStaffSession } from "../../../../server/auth";

export default async function EventAdminLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ eventId: string }>;
}>) {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  const { eventId } = await params;
  if (session.eventId && session.eventId !== eventId) notFound();
  const event = (
    await getDatabase()
      .select({ id: events.id, name: events.name, status: events.status })
      .from(events)
      .where(and(eq(events.tenantId, session.tenantId), eq(events.id, eventId)))
      .limit(1)
  )[0];
  if (!event) notFound();

  return (
    <div className="admin-event-workspace">
      <aside className="admin-event-sidebar">
        <p className="eyebrow">CURRENT EVENT</p>
        <h2>{event.name}</h2>
        <dl className="admin-event-meta">
          <dt>状態</dt>
          <dd>{getEventStatusLabel(event.status)}</dd>
          <dt>権限</dt>
          <dd>{STAFF_ROLE_LABELS[session.role]}</dd>
        </dl>
        <AdminEventNavigation groups={getEventAdminNavigation(session.role, eventId)} />
      </aside>
      <div className="admin-event-content">{children}</div>
    </div>
  );
}
