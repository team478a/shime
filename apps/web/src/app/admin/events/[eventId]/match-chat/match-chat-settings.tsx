"use client";

import { useState } from "react";
import type { MatchChatConfig } from "@shime/match-chat";
import { useMatchChatAdmin } from "@shime/web/hooks/use-match-chat-admin";

const CATEGORY_LABELS = {
  harassment: "嫌がらせ",
  spam: "迷惑行為・連投",
  inappropriate: "不適切な内容",
  safety_concern: "安全上の懸念",
  other: "その他",
} as const;

const STATUS_LABELS = { open: "未対応", reviewing: "確認中", resolved: "対応済み" } as const;

export function MatchChatSettings({ eventId }: { eventId: string }) {
  const admin = useMatchChatAdmin(eventId);
  const [message, setMessage] = useState<string | null>(null);

  async function updateReport(reportId: string, status: "reviewing" | "resolved") {
    setMessage(null);
    if (await admin.updateReport(reportId, status)) {
      setMessage(status === "reviewing" ? "通報を確認中にしました。" : "通報を対応済みにしました。");
    }
  }

  return (
    <main className="admin-stack">
      <section className="panel settings-panel">
        <p className="eyebrow">MATCH CHAT OPERATIONS</p>
        <h1>マッチ後チャット設定・通報対応</h1>
        <p className="current-operation-event">
          <span>対象イベント</span>
          <strong>{admin.workspace?.eventName ?? "読み込み中"}</strong>
        </p>
        <p>双方同意、利用時間、送信制限を設定します。通報画面にチャット本文は表示しません。</p>
        {admin.error && (
          <p className="operation-feedback-error" role="alert">
            操作を完了できませんでした（{admin.error}）。
          </p>
        )}
        {message && (
          <p className="operation-feedback" role="status">
            {message}
          </p>
        )}
      </section>

      <section className="panel settings-panel">
        <h2>利用設定</h2>
        {admin.loading || !admin.workspace ? (
          <p>読み込み中です。</p>
        ) : (
          <MatchChatConfigForm
            key={JSON.stringify(admin.workspace.config)}
            initialConfig={admin.workspace.config}
            busy={admin.busy}
            onSave={async (config) => {
              setMessage(null);
              if (await admin.saveConfig(config)) setMessage("チャット設定を保存しました。");
            }}
          />
        )}
      </section>

      <section className="panel settings-panel">
        <h2>通報対応</h2>
        <p>参加者番号、分類、参加者が入力した通報内容を確認します。相手との会話本文は閲覧できません。</p>
        {!admin.workspace?.reports.length ? (
          <p className="empty-state">現在、通報はありません。</p>
        ) : (
          <div className="admin-card-list">
            {admin.workspace.reports.map((report) => (
              <article className="admin-list-card" key={report.id}>
                <div>
                  <strong>{STATUS_LABELS[report.status]}</strong>
                  <p>
                    通報者: {report.reporterParticipantNumber ?? "番号未採番"} / 対象者:{" "}
                    {report.reportedParticipantNumber ?? "番号未採番"}
                  </p>
                  <p>分類: {CATEGORY_LABELS[report.category]}</p>
                  {report.detail && <p className="pre-wrap">内容: {report.detail}</p>}
                  <small>{new Date(report.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</small>
                </div>
                {report.status !== "resolved" && (
                  <div className="actions">
                    {report.status === "open" && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => updateReport(report.id, "reviewing")}
                        disabled={admin.busy}
                      >
                        確認を開始
                      </button>
                    )}
                    <button type="button" onClick={() => updateReport(report.id, "resolved")} disabled={admin.busy}>
                      対応済みにする
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function MatchChatConfigForm({
  initialConfig,
  busy,
  onSave,
}: {
  initialConfig: MatchChatConfig;
  busy: boolean;
  onSave: (config: MatchChatConfig) => Promise<void>;
}) {
  const [config, setConfig] = useState(initialConfig);
  return (
    <div className="stack">
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(event) => setConfig({ ...config, enabled: event.target.checked })}
        />
        <span>マッチ成立後チャットを有効にする</span>
      </label>
      <div className="settings-grid">
        <label>
          利用時間（時間）
          <input
            inputMode="numeric"
            type="number"
            min="1"
            max="168"
            value={config.windowHours}
            onChange={(event) => setConfig({ ...config, windowHours: Number(event.target.value) })}
          />
        </label>
        <label>
          1分あたり送信上限
          <input
            inputMode="numeric"
            type="number"
            min="1"
            max="60"
            value={config.messagesPerMinute}
            onChange={(event) => setConfig({ ...config, messagesPerMinute: Number(event.target.value) })}
          />
        </label>
        <label>
          1通の最大文字数
          <input
            inputMode="numeric"
            type="number"
            min="1"
            max="2000"
            value={config.maxMessageLength}
            onChange={(event) => setConfig({ ...config, maxMessageLength: Number(event.target.value) })}
          />
        </label>
        <label>
          本文保持日数
          <input
            inputMode="numeric"
            type="number"
            min="1"
            max="3650"
            value={config.retentionDays ?? ""}
            onChange={(event) =>
              setConfig({ ...config, retentionDays: event.target.value ? Number(event.target.value) : null })
            }
          />
        </label>
      </div>
      <label>
        同意規約の版
        <input
          maxLength={80}
          placeholder="例: match-chat-2026-08-01"
          value={config.termsVersion ?? ""}
          onChange={(event) => setConfig({ ...config, termsVersion: event.target.value || null })}
        />
      </label>
      <label>
        チャット利用規約本文
        <textarea
          maxLength={50000}
          rows={12}
          placeholder="参加者が同意前に確認する正式な規約本文を入力してください"
          value={config.termsBody ?? ""}
          onChange={(event) => setConfig({ ...config, termsBody: event.target.value || null })}
        />
      </label>
      <label>
        通報対応責任者
        <input
          maxLength={120}
          placeholder="例: 当日運営責任者"
          value={config.reportOwnerLabel ?? ""}
          onChange={(event) => setConfig({ ...config, reportOwnerLabel: event.target.value || null })}
        />
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={config.uatConfirmed}
          onChange={(event) => setConfig({ ...config, uatConfirmed: event.target.checked })}
        />
        <span>隔離UATで合成参加者2名の双方同意・送信・ブロック・通報・期限切れを確認した</span>
      </label>
      <p className="field-note">
        本番イベントの有効化には正式規約の版と本文、本文保持日数、通報対応責任者、隔離UAT完了の全項目が必要です。
      </p>
      <button type="button" onClick={() => void onSave(config)} disabled={busy}>
        設定を保存
      </button>
    </div>
  );
}
