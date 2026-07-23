import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { emotionCards, eventDreamSettings, events, getDatabase } from "@shime/db";
import { participantHandler } from "@shime/web/server/api/participant-handler";

export const GET = participantHandler(
  async (_request: Request, { params }: { params: Promise<{ eventId: string }> }) => (await params).eventId,
  async ({ eventId, session }) => {
    const db = getDatabase();
    const settings = await db
      .select()
      .from(eventDreamSettings)
      .where(and(eq(eventDreamSettings.tenantId, session.tenantId), eq(eventDreamSettings.eventId, eventId)))
      .limit(1);
    if (!settings[0]?.cardSetId) return NextResponse.json({ code: "DREAM_NOT_CONFIGURED" }, { status: 409 });
    const eventRows = await db
      .select({ registrationMode: events.dreamRegistrationMode })
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId)))
      .limit(1);
    const cards = await db
      .select({
        id: emotionCards.id,
        name: emotionCards.name,
        imageKey: emotionCards.imageKey,
        description: emotionCards.description,
      })
      .from(emotionCards)
      .where(
        and(
          eq(emotionCards.tenantId, session.tenantId),
          eq(emotionCards.cardSetId, settings[0].cardSetId),
          eq(emotionCards.active, true),
        ),
      )
      .orderBy(asc(emotionCards.displayOrder));
    return NextResponse.json({ data: { cards, registrationMode: eventRows[0]?.registrationMode } });
  },
);
