import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { events, getDatabase, participants } from "@shime/db";
import { participantHandler } from "@shime/web/server/api/participant-handler";

const input = z.object({ eventId: z.string().uuid() });

const skipDream = participantHandler(
  (_request: Request, data: z.infer<typeof input>) => data.eventId,
  async ({ eventId, participant, session }) => {
    const event = await getDatabase()
      .select({ mode: events.dreamRegistrationMode })
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId)))
      .limit(1);
    if (event[0]?.mode !== "optional") return NextResponse.json({ code: "DREAM_REQUIRED" }, { status: 409 });
    await getDatabase()
      .update(participants)
      .set({ dreamState: "skipped", updatedAt: new Date() })
      .where(
        and(
          eq(participants.id, participant.id),
          eq(participants.tenantId, session.tenantId),
          eq(participants.eventId, eventId),
        ),
      );
    return NextResponse.json({ data: { skipped: true } });
  },
);

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  return skipDream(request, parsed.data);
}
