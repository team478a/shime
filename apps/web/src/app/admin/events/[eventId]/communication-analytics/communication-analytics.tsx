"use client";

import type { AnonymousAnalyticsSection, AnonymousCount } from "@shime/operations-analytics";
import { useOperationsAnalytics } from "@shime/web/hooks/use-operations-analytics";

const INTERACTION_METRICS = {
  memoCount: "記録された会話メモ",
  favoriteCount: "お気に入り",
  wantsToTalkMoreCount: "もう一度話したい",
} as const;

const CHAT_METRICS = {
  roomCount: "作成されたチャット",
  openRoomCount: "利用中のチャット",
  blockedRoomCount: "ブロックされたチャット",
  messageCount: "送信メッセージ",
  reportCount: "通報",
} as const;

const REPORT_STATUS_LABELS: Record<string, string> = {
  open: "未対応",
  reviewing: "確認中",
  resolved: "対応済み",
};

function CountValue({ count }: { count: AnonymousCount }) {
  return <strong>{count.suppressed ? "非表示" : `${count.value ?? 0}件`}</strong>;
}

function AnalyticsSection({
  title,
  description,
  section,
  labels,
  distributionTitle,
  distributionLabels,
}: {
  title: string;
  description: string;
  section: AnonymousAnalyticsSection;
  labels: Record<string, string>;
  distributionTitle: string;
  distributionLabels?: Record<string, string>;
}) {
  return (
    <section className="panel settings-panel">
      <h2>{title}</h2>
      <p>{description}</p>
      {!section.available ? (
        <p className="operation-feedback-warning" role="status">
          匿名性を守るため、対象者が5名以上になるまで集計を表示しません。
        </p>
      ) : (
        <>
          <p className="field-note">集計対象者: {section.cohortSize}名</p>
          <div className="admin-card-list">
            {Object.entries(section.metrics).map(([key, count]) => (
              <article className="admin-list-card" key={key}>
                <span>{labels[key] ?? key}</span>
                <CountValue count={count} />
              </article>
            ))}
          </div>
          <h3>{distributionTitle}</h3>
          {!section.distribution.length ? (
            <p className="empty-state">集計データはまだありません。</p>
          ) : (
            <div className="admin-card-list">
              {section.distribution.map((item) => (
                <article className="admin-list-card" key={item.key}>
                  <span>{distributionLabels?.[item.key] ?? item.key}</span>
                  <CountValue count={item.count} />
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function CommunicationAnalytics({ eventId }: { eventId: string }) {
  const analytics = useOperationsAnalytics(eventId);
  return (
    <main className="admin-stack">
      <section className="panel settings-panel">
        <p className="eyebrow">ANONYMOUS OPERATIONS ANALYTICS</p>
        <h1>コミュニケーション匿名集計</h1>
        <p className="current-operation-event">
          <span>対象イベント</span>
          <strong>{analytics.data?.eventName ?? "読み込み中"}</strong>
        </p>
        <p>
          会話メモとマッチ後チャットの利用状況を匿名で確認します。個人番号、メモ本文、チャット本文、通報補足は表示しません。
        </p>
        <p className="field-note">5名未満の集計全体と、1〜2件の個別集計は、参加者を推測できないよう非表示にします。</p>
        {analytics.error && (
          <p className="operation-feedback-error" role="alert">
            集計を読み込めませんでした（{analytics.error}）。
          </p>
        )}
        {analytics.loading && <p>読み込み中です。</p>}
      </section>

      {analytics.data && (
        <>
          <AnalyticsSection
            title="会話メモ"
            description="参加者が自分用に記録したメモの件数だけを集計します。自由記述は取得しません。"
            section={analytics.data.interaction}
            labels={INTERACTION_METRICS}
            distributionTitle="気持ちタグ別"
          />
          <AnalyticsSection
            title="マッチ後チャット"
            description="チャットの運用件数だけを集計します。暗号化された会話本文は取得しません。"
            section={analytics.data.matchChat}
            labels={CHAT_METRICS}
            distributionTitle="通報対応状況"
            distributionLabels={REPORT_STATUS_LABELS}
          />
        </>
      )}
    </main>
  );
}
