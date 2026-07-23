import { redirect, notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { emotionCards, emotionCardSets, eventDreamSettings, events, getDatabase } from "@shime/db";
import { getStaffSession } from "@shime/web/server/auth";
import { DreamSettingsForm } from "./dream-settings-form";
export default async function DreamSettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  const { eventId } = await params;
  const db = getDatabase();
  const eventRows = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.tenantId, session.tenantId)))
    .limit(1);
  const event = eventRows[0];
  if (!event) notFound();
  const settingRows = await db
    .select()
    .from(eventDreamSettings)
    .where(and(eq(eventDreamSettings.eventId, eventId), eq(eventDreamSettings.tenantId, session.tenantId)))
    .limit(1);
  const setting = settingRows[0];
  const setRows = setting?.cardSetId
    ? await db.select().from(emotionCardSets).where(eq(emotionCardSets.id, setting.cardSetId)).limit(1)
    : [];
  const cardSet = setRows[0];
  const cards = cardSet
    ? await db
        .select()
        .from(emotionCards)
        .where(and(eq(emotionCards.cardSetId, cardSet.id), eq(emotionCards.active, true)))
        .orderBy(asc(emotionCards.displayOrder))
    : [];
  const initial = {
    registrationMode: event.dreamRegistrationMode,
    aiEnabled: setting?.aiEnabled ?? false,
    aiTimeoutMs: setting?.aiTimeoutMs ?? 10_000,
    fallbackBridgeTemplate:
      setting?.fallbackBridgeTemplate ?? "{card}を選んだ今の気持ちから、{wish}を大切にする未来を考えてみましょう。",
    fallbackCandidates: setting?.fallbackCandidates ?? [
      "{wish}を日々の中で育てる",
      "大切な人と{wish}を分かち合う",
      "{wish}につながる一歩を始める",
    ],
    projectConsentVersion: setting?.projectConsentVersion ?? "",
    cardSetCode: cardSet?.code ?? "default",
    cardSetName: cardSet?.name ?? "標準感情カード",
    cardSetVersion: cardSet?.version ?? 1,
    cardsText: cards.map((card) => [card.name, card.imageKey ?? "", card.description ?? ""].join(" | ")).join("\n"),
  };
  return (
    <main>
      <DreamSettingsForm eventId={eventId} initial={initial} />
    </main>
  );
}
