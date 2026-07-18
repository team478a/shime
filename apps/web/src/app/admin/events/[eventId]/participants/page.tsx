import { and, asc, eq } from "drizzle-orm";
import { buildLiffEventEntryLink, hasPermission } from "@shime/core";
import { applications, events, getDatabase, participants } from "@shime/db";
import { notFound, redirect } from "next/navigation";
import { getStaffSession } from "@shime/web/server/auth";
import { getLineClientConfig } from "@shime/web/server/line-client-config";
import { ParticipantLinkConsole } from "./participant-link-console";

export default async function ParticipantsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  if (!hasPermission(session.role, "event:write")) redirect("/admin");
  const { eventId } = await params;
  if (session.eventId && session.eventId !== eventId) notFound();
  const db = getDatabase();
  const event = (await db.select({ id: events.id, name: events.name }).from(events).where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId))).limit(1))[0];
  if (!event) notFound();
  const rows = await db.select({ id: participants.id, participantNumber: participants.participantNumber, fullName: applications.fullName, linkedUserId: participants.userId, linkTokenExpiresAt: participants.linkTokenExpiresAt, linkTokenUsedAt: participants.linkTokenUsedAt }).from(participants).innerJoin(applications, and(eq(applications.id, participants.applicationId), eq(applications.tenantId, participants.tenantId), eq(applications.eventId, participants.eventId))).where(and(eq(participants.tenantId, session.tenantId), eq(participants.eventId, eventId))).orderBy(asc(participants.createdAt));
  const line = await getLineClientConfig(session.tenantId);
  const eventEntryUrl = buildLiffEventEntryLink(line.liffId, eventId);
  return <main>
    {eventEntryUrl && rows.some((row) => Boolean(row.linkedUserId)) && <section className="panel wide">
      <h2>連携済み参加者の再開</h2>
      <p>本人連携を繰り返さず、連携済みのLINEアカウントで参加画面を再開します。</p>
      <a className="button-link" href={eventEntryUrl}>LINEで参加画面を再開</a>
    </section>}
    <ParticipantLinkConsole eventId={eventId} eventName={event.name} liffId={line.liffId} initial={rows.map((row) => ({ id: row.id, participantNumber: row.participantNumber, fullName: row.fullName, linked: Boolean(row.linkedUserId), linkTokenExpiresAt: row.linkTokenExpiresAt?.toISOString() ?? null, linkTokenUsed: Boolean(row.linkTokenUsedAt) }))} />
  </main>;
}
