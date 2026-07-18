import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { events, getDatabase } from "@shime/db";
import { getStaffSession } from "@shime/web/server/auth";
import { CheckinConsole } from "./checkin-console";
export default async function CheckinPage({ params }: { params: Promise<{ eventId: string }> }) { const session = await getStaffSession(); if (!session) redirect("/admin/login"); const { eventId } = await params; if (session.eventId && session.eventId !== eventId) notFound(); const rows = await getDatabase().select({ id: events.id, name: events.name }).from(events).where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId))).limit(1); if (!rows[0]) notFound(); return <main><CheckinConsole eventId={eventId} eventName={rows[0].name} /></main>; }
