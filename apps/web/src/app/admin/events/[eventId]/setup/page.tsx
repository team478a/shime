import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { hasPermission } from "@shime/core";
import { events, getDatabase } from "@shime/db";
import { notFound, redirect } from "next/navigation";
import { getStaffSession } from "../../../../../server/auth";
import { getEventConfigurationReadiness } from "../../../../../server/event-settings";
import { buildEventSetupSections } from "../../../../../server/event-setup";
import { getEventStatusLabel } from "../../../../../lib/status-labels";

export default async function EventSetupPage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  if (!hasPermission(session.role, "event:write")) redirect("/admin");
  const { eventId } = await params;
  if (session.eventId && session.eventId !== eventId) notFound();
  const event = (
    await getDatabase()
      .select()
      .from(events)
      .where(and(eq(events.tenantId, session.tenantId), eq(events.id, eventId)))
      .limit(1)
  )[0];
  if (!event) notFound();
  const readiness = await getEventConfigurationReadiness(session.tenantId, eventId, event);
  const sections = buildEventSetupSections(eventId, readiness.issues);

  return (
    <main>
      <section className="panel admin-panel">
        <p className="eyebrow">EVENT SETUP</p>
        <h1>イベント設定チェック</h1>
        <p>
          <strong>{event.name}</strong> / 状態: {getEventStatusLabel(event.status)}
        </p>
        <section className={readiness.complete ? "configuration-complete" : "configuration-incomplete"}>
          <h2>
            {readiness.complete ? "受付開始に必要な設定が揃っています" : `未確定・未設定 ${readiness.issues.length}件`}
          </h2>
          <p>
            {readiness.complete
              ? "内容を最終確認してから状態を変更してください。"
              : "未確定項目は空欄または暫定値のままで構いません。確定後に各画面から更新してください。"}
          </p>
        </section>
        <ul className="event-list">
          {sections.map((section) => (
            <li key={section.key}>
              <div>
                <strong>{section.title}</strong>
                <small>{section.complete ? "設定済み" : `未確定 ${section.issues.length}件`}</small>
              </div>
              {!section.complete && (
                <ul>
                  {section.issues.map((issue) => (
                    <li key={issue.key}>{issue.label}</li>
                  ))}
                </ul>
              )}
              <Link className="button-link secondary" href={section.href}>
                {section.complete ? "確認・編集" : "設定する"}
              </Link>
            </li>
          ))}
        </ul>
        <div className="actions">
          <Link className="button-link secondary" href="/admin">
            管理トップへ
          </Link>
          <Link className="button-link" href={`/admin/events/${eventId}/settings`}>
            基本設定を開く
          </Link>
        </div>
      </section>
    </main>
  );
}
