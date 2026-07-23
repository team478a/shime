import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createDreamNo, validateDreamText } from "@shime/core";
import { consents, dreamProfiles, eventDreamSettings, getDatabase, participants } from "@shime/db";
import { participantHandler } from "@shime/web/server/api/participant-handler";

const input = z.object({
  eventId: z.string().uuid(),
  dreamText: z.string(),
  visibility: z.enum(["nickname_and_dream", "dream_only", "private"]),
  projectOptIn: z.boolean(),
});

const updateDream = participantHandler(
  (_request: Request, data: z.infer<typeof input>) => data.eventId,
  async ({ eventId, participant, session }, _request: Request, data: z.infer<typeof input>) => {
    let dreamText;
    try {
      dreamText = validateDreamText(data.dreamText);
    } catch {
      return NextResponse.json({ code: "INVALID_DREAM" }, { status: 400 });
    }
    const db = getDatabase();
    const existing = await db
      .select()
      .from(dreamProfiles)
      .where(and(eq(dreamProfiles.tenantId, session.tenantId), eq(dreamProfiles.userId, session.userId)))
      .limit(1);
    const settings = await db
      .select()
      .from(eventDreamSettings)
      .where(and(eq(eventDreamSettings.tenantId, session.tenantId), eq(eventDreamSettings.eventId, eventId)))
      .limit(1);
    if (data.projectOptIn && !settings[0]?.projectConsentVersion)
      return NextResponse.json({ code: "PROJECT_CONSENT_NOT_CONFIGURED" }, { status: 409 });
    const [profile] = await db.transaction(async (tx) => {
      const rows = existing[0]
        ? await tx
            .update(dreamProfiles)
            .set({ dreamText, visibility: data.visibility, confirmedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(dreamProfiles.id, existing[0].id), eq(dreamProfiles.tenantId, session.tenantId)))
            .returning()
        : await tx
            .insert(dreamProfiles)
            .values({
              tenantId: session.tenantId,
              userId: session.userId,
              dreamNo: createDreamNo(),
              dreamText,
              visibility: data.visibility,
              confirmedAt: new Date(),
            })
            .returning();
      await tx
        .update(participants)
        .set({ dreamState: "confirmed", updatedAt: new Date() })
        .where(
          and(
            eq(participants.id, participant.id),
            eq(participants.tenantId, session.tenantId),
            eq(participants.eventId, eventId),
          ),
        );
      if (data.projectOptIn && settings[0]?.projectConsentVersion)
        await tx.insert(consents).values({
          tenantId: session.tenantId,
          userId: session.userId,
          eventId,
          consentType: "dream_project",
          documentVersion: settings[0].projectConsentVersion,
          accepted: true,
          acceptedAt: new Date(),
        });
      return rows;
    });
    return NextResponse.json({ data: { dreamNo: profile?.dreamNo, visibility: profile?.visibility } });
  },
);

export async function PUT(request: Request) {
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  return updateDream(request, parsed.data);
}
