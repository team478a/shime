import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { hasPermission } from "@shime/core";
import { DEFAULT_PARTICIPANT_JOURNEY } from "@shime/event-core";
import { events, getDatabase } from "@shime/db";
import { getStaffSession } from "@shime/web/server/auth";
import { getParticipantJourneySettings } from "@shime/web/server/event-journey-use-cases";

import { publishJourneyAction, saveJourneyAction } from "./actions";
import { JourneySettingsForm } from "./journey-settings-form";

export default async function ParticipantJourneySettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  if (!hasPermission(session.role, "event:write")) redirect("/admin");
  const { eventId } = await params;
  if (session.eventId && session.eventId !== eventId) notFound();
  const [event] = await getDatabase()
    .select({ id: events.id, name: events.name })
    .from(events)
    .where(and(eq(events.tenantId, session.tenantId), eq(events.id, eventId)))
    .limit(1);
  if (!event) notFound();
  const settings = await getParticipantJourneySettings.execute({
    tenantId: session.tenantId,
    eventId,
  });
  if (!settings) notFound();
  const { status } = await searchParams;
  const initialSteps = settings.draft?.steps ?? settings.published?.steps ?? DEFAULT_PARTICIPANT_JOURNEY;

  return (
    <main>
      <section className="panel settings-panel">
        <p className="eyebrow">PARTICIPANT JOURNEY</p>
        <h1>参加者導線</h1>
        <p className="current-operation-event">
          <span>対象イベント</span>
          <strong>{event.name}</strong>
        </p>
        {status === "saved" && (
          <p className="operation-feedback" role="status">
            導線の下書きを保存しました。
          </p>
        )}
        {status === "published" && (
          <p className="operation-feedback" role="status">
            新しい導線バージョンを公開しました。
          </p>
        )}
        {status === "diagnosis-unavailable" && (
          <p className="operation-feedback error" role="alert">
            SHIME診断を公開できません。先にイベントの診断設定をONにしてください。
          </p>
        )}
        <dl>
          <dt>公開中</dt>
          <dd>{settings.published ? `バージョン ${settings.published.version}` : "既定の導線"}</dd>
          <dt>下書き</dt>
          <dd>{settings.draft ? `バージョン ${settings.draft.version}` : "なし"}</dd>
        </dl>
        <JourneySettingsForm
          initialSteps={initialSteps}
          saveAction={saveJourneyAction.bind(null, eventId)}
          publishAction={publishJourneyAction.bind(null, eventId)}
        />
      </section>
    </main>
  );
}
