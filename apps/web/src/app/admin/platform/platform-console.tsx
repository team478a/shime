"use client";
import { useEffect, useState, type FormEvent } from "react";
type Data = {
  line: {
    enabled: boolean;
    channelId: string;
    liffId: string;
    liffUrl: string | null;
    endpointUrl: string | null;
    webhookUrl: string | null;
    secretConfigured: boolean;
    fingerprint: string | null;
    lastCheckStatus: string | null;
  };
  openai: {
    enabled: boolean;
    model: string;
    secretConfigured: boolean;
    fingerprint: string | null;
    lastCheckStatus: string | null;
  };
  operations: {
    customDomain: string | null;
    healthcheckUrl: string | null;
    monitoringEnabled: boolean;
    notificationFailureThreshold: number;
  };
  schedule: {
    enabled: boolean;
    cronExpression: string;
    timezone: string;
    lastRunAt: string | null;
    lastRunStatus: string | null;
  };
  templates: Array<{
    id: string;
    templateKey: string;
    name: string;
    body: string;
    version: number;
  }>;
  metrics: { failedNotifications: number };
};
export function PlatformConsole() {
  const [data, setData] = useState<Data | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const r = await fetch("/api/admin/platform");
    const b = await r.json();
    if (r.ok) setData(b.data);
    else setMessage(`読み込み失敗: ${b.code}`);
  }
  useEffect(() => {
    // Initial state is loaded from the authenticated administration API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);
  async function save(section: string, form: HTMLFormElement) {
    setBusy(true);
    setMessage("");
    const v = new FormData(form);
    const raw = Object.fromEntries(v);
    let body: Record<string, unknown> = { section, ...raw };
    if (["line", "openai", "schedule"].includes(section)) body.enabled = v.get("enabled") === "on";
    if (section === "operations")
      body = {
        section,
        customDomain: String(v.get("customDomain") ?? "").trim() || null,
        healthcheckUrl: String(v.get("healthcheckUrl") ?? "").trim() || null,
        monitoringEnabled: v.get("monitoringEnabled") === "on",
        notificationFailureThreshold: Number(v.get("notificationFailureThreshold")),
      };
    const r = await fetch("/api/admin/platform", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const b = await r.json();
    setBusy(false);
    setMessage(r.ok ? "設定を保存しました。" : `保存失敗: ${b.code}`);
    if (r.ok) await load();
  }
  async function test(target: string) {
    setBusy(true);
    setMessage("");
    const r = await fetch("/api/admin/platform/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target }),
    });
    const b = await r.json();
    setBusy(false);
    setMessage(r.ok ? `${target}の接続は正常です。` : `${target}の接続失敗: ${b.data?.code ?? b.code}`);
    await load();
  }
  async function saveTemplate(e: FormEvent<HTMLFormElement>, templateKey: string) {
    e.preventDefault();
    setBusy(true);
    const v = new FormData(e.currentTarget);
    const r = await fetch("/api/admin/platform/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        templateKey,
        name: v.get("name"),
        body: v.get("body"),
      }),
    });
    const b = await r.json();
    setBusy(false);
    setMessage(r.ok ? "通知テンプレートの新しい版を保存しました。" : `保存失敗: ${b.code}`);
    if (r.ok) await load();
  }
  if (!data)
    return (
      <section className="panel admin-panel">
        <h1>外部接続・運用設定</h1>
        <p>{message || "読み込み中…"}</p>
      </section>
    );
  return (
    <div className="admin-stack">
      <section className="panel wide">
        <p className="eyebrow">PLATFORM OPERATIONS</p>
        <h1>外部接続・運用設定</h1>
        <p>秘密値は保存後に再表示しません。空欄で保存すると現在の値を維持します。</p>
        {message && <p role="status">{message}</p>}
        <a className="button-link secondary" href="/admin">
          管理トップへ
        </a>
      </section>
      <section className="panel wide">
        <h2>LINE Developers</h2>
        <p>
          認証情報:{" "}
          {data.line.secretConfigured
            ? `設定済み${data.line.fingerprint ? ` (${data.line.fingerprint})` : ""}`
            : "未設定"}{" "}
          / 最終確認: {data.line.lastCheckStatus ?? "未実施"}
        </p>
        <p className="hint">保存したLIFF IDは参加者画面へ即時反映されます。以下をLINE Developersへ設定してください。</p>
        <dl>
          <dt>LIFF起動URL</dt>
          <dd>
            {data.line.liffUrl ? (
              <a href={data.line.liffUrl} target="_blank" rel="noreferrer">
                {data.line.liffUrl}
              </a>
            ) : (
              "LIFF ID保存後に表示"
            )}
          </dd>
          <dt>LIFF Endpoint URL</dt>
          <dd>
            <code>{data.line.endpointUrl ?? "公開URL設定後に表示"}</code>
          </dd>
          <dt>Messaging API Webhook URL</dt>
          <dd>
            <code>{data.line.webhookUrl ?? "公開URL設定後に表示"}</code>
          </dd>
        </dl>
        <form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save("line", e.currentTarget);
          }}
        >
          <label>
            <input name="enabled" type="checkbox" defaultChecked={data.line.enabled} /> LINE接続を有効化
          </label>
          <label>
            LINE Login Channel ID
            <input name="channelId" defaultValue={data.line.channelId} />
          </label>
          <label>
            LIFF ID
            <input name="liffId" defaultValue={data.line.liffId} />
          </label>
          <label>
            Messaging API Channel Secret
            <input name="channelSecret" type="password" autoComplete="new-password" />
          </label>
          <label>
            Channel Access Token
            <input name="accessToken" type="password" autoComplete="new-password" />
          </label>
          <div className="actions">
            <button disabled={busy}>保存</button>
            <button type="button" className="secondary" disabled={busy} onClick={() => test("line")}>
              接続確認
            </button>
          </div>
        </form>
      </section>
      <section className="panel wide">
        <h2>AI Provider</h2>
        <p>
          APIキー:{" "}
          {data.openai.secretConfigured
            ? `設定済み${data.openai.fingerprint ? ` (${data.openai.fingerprint})` : ""}`
            : "未設定"}{" "}
          / 最終確認: {data.openai.lastCheckStatus ?? "未実施"}
        </p>
        <form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save("openai", e.currentTarget);
          }}
        >
          <label>
            <input name="enabled" type="checkbox" defaultChecked={data.openai.enabled} /> OpenAIによるDream文案を有効化
          </label>
          <label>
            モデル
            <input name="model" defaultValue={data.openai.model} />
          </label>
          <label>
            新しいAPIキー
            <input name="apiKey" type="password" autoComplete="new-password" />
          </label>
          <p className="hint">AIが失敗・タイムアウトした場合は固定文へ自動で戻ります。</p>
          <div className="actions">
            <button disabled={busy}>保存</button>
            <button type="button" className="secondary" disabled={busy} onClick={() => test("openai")}>
              接続確認
            </button>
          </div>
        </form>
      </section>
      <section className="panel wide">
        <h2>独自ドメイン・監視</h2>
        <p>LINE通知失敗: {data.metrics.failedNotifications}件</p>
        <form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save("operations", e.currentTarget);
          }}
        >
          <label>
            独自ドメイン
            <input name="customDomain" defaultValue={data.operations.customDomain ?? ""} placeholder="example.jp" />
          </label>
          <label>
            Healthcheck URL
            <input name="healthcheckUrl" type="url" defaultValue={data.operations.healthcheckUrl ?? ""} />
          </label>
          <label>
            <input name="monitoringEnabled" type="checkbox" defaultChecked={data.operations.monitoringEnabled} />{" "}
            監視を有効化
          </label>
          <label>
            通知失敗警告の件数
            <input
              name="notificationFailureThreshold"
              type="number"
              min="1"
              defaultValue={data.operations.notificationFailureThreshold}
            />
          </label>
          <div className="actions">
            <button disabled={busy}>保存</button>
            <button type="button" className="secondary" disabled={busy} onClick={() => test("health")}>
              Health確認
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy || !data.operations.customDomain}
              onClick={() => test("domain")}
            >
              独自ドメイン確認
            </button>
          </div>
        </form>
      </section>
      <section className="panel wide">
        <h2>定期ジョブ</h2>
        <p>
          最終実行: {data.schedule.lastRunAt ?? "未実施"} / {data.schedule.lastRunStatus ?? "—"}
        </p>
        <form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save("schedule", e.currentTarget);
          }}
        >
          <label>
            <input name="enabled" type="checkbox" defaultChecked={data.schedule.enabled} /> LINE通知送信ジョブを有効化
          </label>
          <label>
            Cron式
            <input name="cronExpression" defaultValue={data.schedule.cronExpression} />
          </label>
          <label>
            タイムゾーン
            <input name="timezone" value="Asia/Tokyo" readOnly />
          </label>
          <button disabled={busy}>保存</button>
        </form>
      </section>
      <section className="panel wide">
        <h2>通知テンプレート</h2>
        {data.templates.map((t) => (
          <form className="login-form" key={t.id} onSubmit={(e) => saveTemplate(e, t.templateKey)}>
            <h3>
              {t.templateKey} v{t.version}
            </h3>
            <label>
              名称
              <input name="name" defaultValue={t.name} />
            </label>
            <label>
              本文
              <textarea name="body" rows={4} defaultValue={t.body} />
            </label>
            <button disabled={busy}>新しい版として保存</button>
          </form>
        ))}
      </section>
    </div>
  );
}
