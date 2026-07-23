import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@shime/core";
import { auditLogs, emotionCards, emotionCardSets, eventDreamSettings, events, getDatabase } from "@shime/db";
import { requireStaffSession } from "@shime/web/server/auth";
import { mergeEventSettings } from "@shime/web/server/event-settings";
const input = z.object({
  registrationMode: z.enum(["required_private_allowed", "optional"]),
  aiEnabled: z.boolean(),
  aiTimeoutMs: z.number().int().min(1000).max(10000),
  fallbackBridgeTemplate: z.string().min(1).max(1000),
  fallbackCandidates: z.array(z.string().min(1).max(500)).length(3),
  projectConsentVersion: z.string().max(80).nullable(),
  cardSet: z.object({
    code: z.string().regex(/^[a-z0-9_-]{2,80}$/),
    name: z.string().min(1).max(160),
    version: z.number().int().positive(),
    cards: z
      .array(
        z.object({
          name: z.string().min(1).max(120),
          imageKey: z.string().max(1000).nullable(),
          description: z.string().max(2000).nullable(),
        }),
      )
      .min(1)
      .max(100),
  }),
});
export async function PUT(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const requestId = randomUUID();
  const session = await requireStaffSession().catch(() => null);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  try {
    requirePermission(session.role, "event:write");
  } catch {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      {
        code: "INVALID_INPUT",
        field_errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  const { eventId } = await params;
  if (session.eventId && session.eventId !== eventId) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  const db = getDatabase();
  const target = await db
    .select({ id: events.id, settings: events.settings })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId)))
    .limit(1);
  const targetEvent = target[0];
  if (!targetEvent) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  await db.transaction(async (tx) => {
    const existingSets = await tx
      .select()
      .from(emotionCardSets)
      .where(
        and(
          eq(emotionCardSets.tenantId, session.tenantId),
          eq(emotionCardSets.code, parsed.data.cardSet.code),
          eq(emotionCardSets.version, parsed.data.cardSet.version),
        ),
      )
      .limit(1);
    const [cardSet] = existingSets[0]
      ? await tx
          .update(emotionCardSets)
          .set({
            name: parsed.data.cardSet.name,
            active: true,
            updatedAt: new Date(),
          })
          .where(eq(emotionCardSets.id, existingSets[0].id))
          .returning()
      : await tx
          .insert(emotionCardSets)
          .values({
            tenantId: session.tenantId,
            code: parsed.data.cardSet.code,
            name: parsed.data.cardSet.name,
            version: parsed.data.cardSet.version,
          })
          .returning();
    if (!cardSet) throw new Error("CARD_SET_FAILED");
    await tx
      .update(emotionCards)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(emotionCards.tenantId, session.tenantId), eq(emotionCards.cardSetId, cardSet.id)));
    for (const [index, card] of parsed.data.cardSet.cards.entries())
      await tx
        .insert(emotionCards)
        .values({
          tenantId: session.tenantId,
          cardSetId: cardSet.id,
          name: card.name,
          imageKey: card.imageKey,
          description: card.description,
          displayOrder: index + 1,
          active: true,
        })
        .onConflictDoUpdate({
          target: [emotionCards.tenantId, emotionCards.cardSetId, emotionCards.displayOrder],
          set: {
            name: card.name,
            imageKey: card.imageKey,
            description: card.description,
            active: true,
            updatedAt: new Date(),
          },
        });
    await tx
      .update(events)
      .set({
        dreamRegistrationMode: parsed.data.registrationMode,
        settings: mergeEventSettings(targetEvent.settings, {
          cardSetCode: parsed.data.cardSet.code,
        }),
        updatedAt: new Date(),
      })
      .where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId)));
    await tx
      .insert(eventDreamSettings)
      .values({
        tenantId: session.tenantId,
        eventId,
        cardSetId: cardSet.id,
        aiEnabled: parsed.data.aiEnabled,
        aiTimeoutMs: parsed.data.aiTimeoutMs,
        fallbackBridgeTemplate: parsed.data.fallbackBridgeTemplate,
        fallbackCandidates: parsed.data.fallbackCandidates,
        projectConsentVersion: parsed.data.projectConsentVersion,
      })
      .onConflictDoUpdate({
        target: eventDreamSettings.eventId,
        set: {
          cardSetId: cardSet.id,
          aiEnabled: parsed.data.aiEnabled,
          aiTimeoutMs: parsed.data.aiTimeoutMs,
          fallbackBridgeTemplate: parsed.data.fallbackBridgeTemplate,
          fallbackCandidates: parsed.data.fallbackCandidates,
          projectConsentVersion: parsed.data.projectConsentVersion,
          updatedAt: new Date(),
        },
      });
    await tx.insert(auditLogs).values({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      eventId,
      action: "dream.settings.update",
      targetType: "event",
      targetId: eventId,
      after: {
        registrationMode: parsed.data.registrationMode,
        aiEnabled: parsed.data.aiEnabled,
        cardSetCode: parsed.data.cardSet.code,
        cardCount: parsed.data.cardSet.cards.length,
      },
      requestId,
    });
  });
  return NextResponse.json({ ok: true });
}
