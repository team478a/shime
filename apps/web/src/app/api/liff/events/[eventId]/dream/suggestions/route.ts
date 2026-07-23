import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { emotionCards, emotionSelections, eventDreamSettings, getDatabase } from "@shime/db";
import { participantHandler } from "@shime/web/server/api/participant-handler";
import { getDreamProvider } from "@shime/web/server/dream-provider";

export const POST = participantHandler(
  async (_request: Request, { params }: { params: Promise<{ eventId: string }> }) => (await params).eventId,
  async ({ eventId, participant, session }) => {
    const db = getDatabase();
    const rows = await db
      .select({ selection: emotionSelections, cardName: emotionCards.name })
      .from(emotionSelections)
      .innerJoin(
        emotionCards,
        and(
          eq(emotionCards.id, emotionSelections.emotionCardId),
          eq(emotionCards.tenantId, emotionSelections.tenantId),
        ),
      )
      .where(
        and(
          eq(emotionSelections.tenantId, session.tenantId),
          eq(emotionSelections.eventId, eventId),
          eq(emotionSelections.participantId, participant.id),
        ),
      )
      .limit(1);
    const settings = await db
      .select()
      .from(eventDreamSettings)
      .where(and(eq(eventDreamSettings.tenantId, session.tenantId), eq(eventDreamSettings.eventId, eventId)))
      .limit(1);
    if (!rows[0] || !settings[0]) return NextResponse.json({ code: "DREAM_INPUT_INCOMPLETE" }, { status: 409 });
    const providers = await getDreamProvider(
      session.tenantId,
      { bridgeTemplate: settings[0].fallbackBridgeTemplate, candidates: settings[0].fallbackCandidates },
      settings[0].aiEnabled,
      settings[0].aiTimeoutMs,
    );
    const input = {
      cardName: rows[0].cardName,
      firstImpression: rows[0].selection.firstImpression,
      relatedArea: rows[0].selection.relatedArea,
      underlyingWish: rows[0].selection.underlyingWish,
      ...(rows[0].selection.freeText ? { freeText: rows[0].selection.freeText } : {}),
    };
    let result;
    try {
      result = providers.primary ? await providers.primary.suggest(input) : await providers.fallback.suggest(input);
    } catch {
      result = await providers.fallback.suggest(input);
    }
    return NextResponse.json({ data: result });
  },
);
