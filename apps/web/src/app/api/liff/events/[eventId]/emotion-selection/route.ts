import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { emotionCards, emotionSelections, eventDreamSettings, getDatabase, participants } from "@shime/db";
import { participantHandler } from "@shime/web/server/api/participant-handler";

const input = z.object({
  emotionCardId: z.string().uuid(),
  firstImpression: z.string().trim().min(1).max(500),
  relatedArea: z.string().trim().min(1).max(500),
  underlyingWish: z.string().trim().min(1).max(500),
  freeText: z.string().trim().max(2000).optional(),
  redraw: z.boolean().default(false),
  finalize: z.boolean().default(false),
});

export const POST = participantHandler(
  async (_request: Request, { params }: { params: Promise<{ eventId: string }> }) => (await params).eventId,
  async ({ eventId, participant, session }, request: Request) => {
    const parsed = input.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    const db = getDatabase();
    const card = await db
      .select({ id: emotionCards.id })
      .from(emotionCards)
      .innerJoin(
        eventDreamSettings,
        and(
          eq(eventDreamSettings.cardSetId, emotionCards.cardSetId),
          eq(eventDreamSettings.tenantId, emotionCards.tenantId),
        ),
      )
      .where(
        and(
          eq(emotionCards.id, parsed.data.emotionCardId),
          eq(emotionCards.tenantId, session.tenantId),
          eq(eventDreamSettings.eventId, eventId),
          eq(emotionCards.active, true),
        ),
      )
      .limit(1);
    if (!card[0]) return NextResponse.json({ code: "CARD_NOT_FOUND" }, { status: 404 });
    const existing = await db
      .select()
      .from(emotionSelections)
      .where(
        and(
          eq(emotionSelections.tenantId, session.tenantId),
          eq(emotionSelections.eventId, eventId),
          eq(emotionSelections.participantId, participant.id),
        ),
      )
      .limit(1);
    if (existing[0]?.finalizedAt) return NextResponse.json({ code: "SELECTION_FINALIZED" }, { status: 409 });
    const redrawCount = (existing[0]?.redrawCount ?? 0) + (parsed.data.redraw ? 1 : 0);
    if (redrawCount > 1) return NextResponse.json({ code: "REDRAW_LIMIT_EXCEEDED" }, { status: 409 });
    const values = {
      emotionCardId: parsed.data.emotionCardId,
      firstImpression: parsed.data.firstImpression,
      relatedArea: parsed.data.relatedArea,
      underlyingWish: parsed.data.underlyingWish,
      freeText: parsed.data.freeText,
      redrawCount,
      finalizedAt: parsed.data.finalize ? new Date() : null,
      updatedAt: new Date(),
    };
    const [saved] = existing[0]
      ? await db
          .update(emotionSelections)
          .set(values)
          .where(
            and(
              eq(emotionSelections.id, existing[0].id),
              eq(emotionSelections.tenantId, session.tenantId),
              eq(emotionSelections.eventId, eventId),
              eq(emotionSelections.participantId, participant.id),
            ),
          )
          .returning()
      : await db
          .insert(emotionSelections)
          .values({ tenantId: session.tenantId, eventId, participantId: participant.id, ...values })
          .returning();
    await db
      .update(participants)
      .set({ dreamState: "drafting", updatedAt: new Date() })
      .where(
        and(
          eq(participants.id, participant.id),
          eq(participants.tenantId, session.tenantId),
          eq(participants.eventId, eventId),
        ),
      );
    return NextResponse.json({ data: saved });
  },
);
