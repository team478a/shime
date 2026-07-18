import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { events, getDatabase, participants } from "@shime/db";
import { requireParticipantForEvent } from "@shime/web/server/participant-auth";
const input = z.object({ eventId: z.string().uuid() });
export async function POST(request: Request) { const parsed = input.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 }); const auth = await requireParticipantForEvent(parsed.data.eventId).catch(() => null); if (!auth) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 }); const event = await getDatabase().select({ mode: events.dreamRegistrationMode }).from(events).where(and(eq(events.id, parsed.data.eventId), eq(events.tenantId, auth.session.tenantId))).limit(1); if (event[0]?.mode !== "optional") return NextResponse.json({ code: "DREAM_REQUIRED" }, { status: 409 }); await getDatabase().update(participants).set({ dreamState: "skipped", updatedAt: new Date() }).where(eq(participants.id, auth.participant.id)); return NextResponse.json({ data: { skipped: true } }); }
