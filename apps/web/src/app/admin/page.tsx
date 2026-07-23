import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission } from "@shime/core";
import { events, getDatabase } from "@shime/db";
import { getStaffSession } from "../../server/auth";
import { getEventConfigurationReadiness } from "../../server/event-settings";
import { getEventAdminNavigation, getEventAdminQuickActions, STAFF_ROLE_LABELS } from "../../lib/admin-navigation";
import { getAdminPublicDownloads } from "../../lib/public-downloads";
import { getEventStatusLabel } from "../../lib/status-labels";

export default async function AdminPage() {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  const eventRows = await getDatabase().select().from(events).where(eq(events.tenantId, session.tenantId));
  const canWriteEvent = hasPermission(session.role, "event:write");
  const eventItems = await Promise.all(eventRows.map(async (event) => {
    const navigation = getEventAdminNavigation(session.role, event.id);
    const items = navigation.flatMap((group) => group.items);
    const quickActions = getEventAdminQuickActions(session.role, event.id);
    return {
      event,
      configuration: await getEventConfigurationReadiness(session.tenantId, event.id, event),
      href: items[0]?.href,
      checkinHref: quickActions.find((item) => item.key === "checkin")?.href,
      analyticsHref: items.find((item) => item.key === "analytics")?.href,
      participantsHref: quickActions.find((item) => item.key === "participants")?.href,
      seatingHref: quickActions.find((item) => item.key === "seating")?.href,
    };
  }));
  return <main><section className="panel admin-panel admin-dashboard"><p className="eyebrow">ADMIN DASHBOARD</p><h1>{session.displayName}さん</h1><p>担当するイベントと、現在の設定状況を確認できます。</p><dl className="admin-profile"><dt>権限</dt><dd>{STAFF_ROLE_LABELS[session.role]}</dd></dl>
    <details className="admin-resource-downloads">
      <summary>運用資料をダウンロード</summary>
      <div className="actions">
        {getAdminPublicDownloads().map((document) => <a key={document.outputName} className="button-link secondary" href={`/downloads/${document.outputName}`} download>{document.label}</a>)}
      </div>
    </details>
    <div className="actions"><h2>イベント</h2>{canWriteEvent && <Link className="button-link" href="/admin/events/new">イベントを作成</Link>}</div>
    {eventItems.length ? <ul className="event-list admin-event-list">{eventItems.map(({ event, configuration, href, analyticsHref, checkinHref, participantsHref, seatingHref }) => <li key={event.id}><div><strong>{event.name}</strong><small>{getEventStatusLabel(event.status)} / {configuration.complete ? "必須設定入力済み" : `未設定 ${configuration.issues.length}件`}</small></div><div className="event-quick-actions">{analyticsHref && <Link className="button-link" href={analyticsHref}>運営進捗</Link>}{checkinHref && <Link className="button-link event-checkin-link" href={checkinHref}>当日受付</Link>}{seatingHref && <Link className="button-link" href={seatingHref}>席配置</Link>}{participantsHref && <Link className="button-link secondary" href={participantsHref}>参加者・LINE連携</Link>}{href && <Link className="button-link secondary" href={href}>設定・詳細</Link>}</div></li>)}</ul> : <p>イベントがありません。責任者またはシステム管理者が下書きイベントを作成してください。</p>}
  </section></main>;
}
