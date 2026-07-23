"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { EVENT_STATUSES, EVENT_STATUS_LABELS, getEventStatusLabel } from "../../../lib/status-labels";

type Configuration = { complete: boolean; issues: Array<{ key: string; label: string; kind: "missing" | "invalid" }> };
type InitialEvent = {
  id: string;
  code: string;
  name: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  venueName: string | null;
  venueAddress: string | null;
  capacity: number;
  applicationOpensAt: string | null;
  applicationClosesAt: string | null;
  dreamRegistrationMode: "required_private_allowed" | "optional";
  preferenceMode: "mutual_up_to_2" | "first_choice_only" | "ranked_up_to_3";
  preferenceOpensAt: string | null;
  preferenceClosesAt: string | null;
  allowMultipleMatches: boolean;
  settings: Record<string, unknown>;
};

function jstInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
  return parts.replace(" ", "T");
}

function toJstIso(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text ? `${text}:00+09:00` : null;
}

function settingString(settings: Record<string, unknown>, key: string, fallback = ""): string {
  const value = settings[key];
  return typeof value === "string" ? value : fallback;
}

function settingNumber(settings: Record<string, unknown>, key: string, fallback = ""): string | number {
  const value = settings[key];
  return typeof value === "number" ? value : fallback;
}

export function EventSettingsForm({
  mode,
  initial,
  configuration,
  canDelete = false,
}: {
  mode: "create" | "edit";
  initial?: InitialEvent;
  configuration?: Configuration;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Configuration | undefined>(configuration);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const currentStatusIndex = initial ? EVENT_STATUSES.indexOf(initial.status as (typeof EVENT_STATUSES)[number]) : -1;
  const transitionTargets = initial
    ? EVENT_STATUSES.filter((_, index) => index < currentStatusIndex || index === currentStatusIndex + 1)
    : [];
  const [targetStatus, setTargetStatus] = useState<string>(transitionTargets[transitionTargets.length - 1] ?? "");
  const [transitionReason, setTransitionReason] = useState("");
  const settings = initial?.settings ?? {};
  const categories = Array.isArray(settings.participantCategories)
    ? (settings.participantCategories as Array<Record<string, unknown>>)
    : [];
  const numbering =
    settings.participantNumber && typeof settings.participantNumber === "object"
      ? (settings.participantNumber as Record<string, unknown>)
      : {};

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {
      name: String(form.get("name") ?? ""),
      startsAt: toJstIso(form.get("startsAt")),
      endsAt: toJstIso(form.get("endsAt")),
      venueName: String(form.get("venueName") ?? "").trim() || null,
      venueAddress: String(form.get("venueAddress") ?? "").trim() || null,
      capacity: Number(form.get("capacity")),
      applicationOpensAt: toJstIso(form.get("applicationOpensAt")),
      applicationClosesAt: toJstIso(form.get("applicationClosesAt")),
      dreamRegistrationMode: form.get("dreamRegistrationMode"),
      preferenceMode: form.get("preferenceMode"),
      preferenceOpensAt: toJstIso(form.get("preferenceOpensAt")),
      preferenceClosesAt: toJstIso(form.get("preferenceClosesAt")),
      allowMultipleMatches: form.get("allowMultipleMatches") === "on",
      participantNumber: {
        groupAPrefix: String(form.get("groupAPrefix") ?? "A"),
        groupBPrefix: String(form.get("groupBPrefix") ?? "B"),
        digits: Number(form.get("numberDigits")),
      },
      contactExchangeMode: form.get("contactExchangeMode"),
    };
    if (mode === "create") body.code = String(form.get("code") ?? "");

    const categoryValues = [
      { code: String(form.get("categoryACode") ?? "").trim(), label: String(form.get("categoryALabel") ?? "").trim() },
      { code: String(form.get("categoryBCode") ?? "").trim(), label: String(form.get("categoryBLabel") ?? "").trim() },
    ];
    if (categoryValues.every((category) => category.code && category.label))
      body.participantCategories = categoryValues;

    for (const key of ["conversationRounds", "retentionDays"] as const) {
      const value = String(form.get(key) ?? "").trim();
      if (value) body[key] = Number(value);
    }
    for (const key of ["cardSetCode", "eventTermsVersion", "privacyVersion"] as const) {
      const value = String(form.get(key) ?? "").trim();
      if (value) body[key] = value;
    }

    const response = await fetch(mode === "create" ? "/api/admin/events" : `/api/admin/events/${initial?.id}`, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setStatus(result.configuration);
      setMessage(
        result.code === "INVALID_DATE_RANGE"
          ? "日時の前後関係を確認してください。"
          : "保存できませんでした。入力内容を確認してください。",
      );
      return;
    }
    if (mode === "create") {
      router.replace(`/admin/events/${result.data.id}/settings`);
      router.refresh();
      return;
    }
    setStatus(result.data.configuration);
    setMessage("イベント設定を保存しました。");
    router.refresh();
  }

  async function transitionStatus() {
    if (!initial || !targetStatus) return;
    if (!window.confirm(`イベント状態を「${getEventStatusLabel(targetStatus)}」へ変更しますか？`)) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/events/${initial.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: targetStatus, reason: transitionReason || undefined }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setStatus(result.configuration ?? status);
      setMessage(
        result.code === "CONFIGURATION_INCOMPLETE"
          ? "必須設定が未完了のため受付を開始できません。"
          : `状態を変更できません: ${result.code}`,
      );
      return;
    }
    setMessage("イベント状態を変更しました。");
    router.refresh();
  }

  async function deleteEvent() {
    if (!initial) return;
    const confirmCode = window.prompt(`削除確認のためイベントコード「${initial.code}」を入力してください`);
    if (confirmCode !== initial.code) {
      setMessage("イベントコードが一致しないため削除しませんでした。");
      return;
    }
    const reason = window.prompt("削除理由を入力してください");
    if (!reason || reason.trim().length < 3) {
      setMessage("削除理由が必要です。");
      return;
    }
    if (!window.confirm("この下書きイベントを完全に削除します。よろしいですか？")) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/events/${initial.id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmCode, reason }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(
        result.code === "EVENT_HAS_OPERATIONAL_DATA"
          ? "参加者・取込・通知などの運用データがあるため削除できません。"
          : `削除できません: ${result.code}`,
      );
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <form className="settings-form" onSubmit={submit}>
      {initial && (
        <p>
          状態: <strong>{getEventStatusLabel(initial.status)}</strong>
        </p>
      )}
      {status && (
        <section className={status.complete ? "configuration-complete" : "configuration-incomplete"}>
          <h2>{status.complete ? "本番必須設定は入力済みです" : `未入力・要確認 ${status.issues.length}件`}</h2>
          {!status.complete && (
            <ul>
              {status.issues.map((issue) => (
                <li key={`${issue.key}-${issue.kind}`}>{issue.label}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <fieldset>
        <legend>基本情報</legend>
        {mode === "create" && (
          <label>
            イベントコード
            <input name="code" pattern="[a-z0-9-]{3,80}" placeholder="shime-20260808" required />
          </label>
        )}
        <label>
          正式イベント名
          <input name="name" defaultValue={initial?.name ?? ""} required />
        </label>
        <div className="settings-grid">
          <label>
            開始日時（日本時間）
            <input name="startsAt" type="datetime-local" defaultValue={jstInputValue(initial?.startsAt)} required />
          </label>
          <label>
            終了日時（日本時間）
            <input name="endsAt" type="datetime-local" defaultValue={jstInputValue(initial?.endsAt)} />
          </label>
        </div>
        <label>
          会場名
          <input name="venueName" defaultValue={initial?.venueName ?? ""} />
        </label>
        <label>
          会場住所
          <textarea name="venueAddress" defaultValue={initial?.venueAddress ?? ""} />
        </label>
        <label>
          定員
          <input name="capacity" type="number" min="1" max="10000" defaultValue={initial?.capacity ?? 50} required />
        </label>
      </fieldset>

      <fieldset>
        <legend>申込受付</legend>
        <div className="settings-grid">
          <label>
            受付開始（日本時間）
            <input
              name="applicationOpensAt"
              type="datetime-local"
              defaultValue={jstInputValue(initial?.applicationOpensAt)}
            />
          </label>
          <label>
            受付終了（日本時間）
            <input
              name="applicationClosesAt"
              type="datetime-local"
              defaultValue={jstInputValue(initial?.applicationClosesAt)}
            />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Dream・希望入力</legend>
        <label>
          夢登録方式
          <select
            name="dreamRegistrationMode"
            defaultValue={initial?.dreamRegistrationMode ?? "required_private_allowed"}
          >
            <option value="required_private_allowed">夢登録必須・非公開可</option>
            <option value="optional">夢登録任意</option>
          </select>
        </label>
        <label>
          希望入力方式
          <select name="preferenceMode" defaultValue={initial?.preferenceMode ?? "mutual_up_to_2"}>
            <option value="mutual_up_to_2">最大2名・順位なし</option>
            <option value="first_choice_only">第1希望1名のみ</option>
            <option value="ranked_up_to_3">第1〜第3希望</option>
          </select>
        </label>
        <div className="settings-grid">
          <label>
            希望入力開始（日本時間）
            <input
              name="preferenceOpensAt"
              type="datetime-local"
              defaultValue={jstInputValue(initial?.preferenceOpensAt)}
            />
          </label>
          <label>
            希望入力締切（日本時間）
            <input
              name="preferenceClosesAt"
              type="datetime-local"
              defaultValue={jstInputValue(initial?.preferenceClosesAt)}
            />
          </label>
        </div>
        <label className="choice">
          <input name="allowMultipleMatches" type="checkbox" defaultChecked={initial?.allowMultipleMatches ?? false} />
          複数成立を許可する
        </label>
        <label>
          成立後の連絡方法
          <select
            name="contactExchangeMode"
            defaultValue={settingString(settings, "contactExchangeMode", "operator_mediated")}
          >
            <option value="operator_mediated">運営仲介</option>
            <option value="mutual_consent_display">双方同意後に表示</option>
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>参加区分・番号</legend>
        <div className="settings-grid">
          <label>
            区分Aコード
            <input name="categoryACode" defaultValue={String(categories[0]?.code ?? "group_a")} />
          </label>
          <label>
            区分A表示名
            <input name="categoryALabel" defaultValue={String(categories[0]?.label ?? "")} />
          </label>
          <label>
            区分Bコード
            <input name="categoryBCode" defaultValue={String(categories[1]?.code ?? "group_b")} />
          </label>
          <label>
            区分B表示名
            <input name="categoryBLabel" defaultValue={String(categories[1]?.label ?? "")} />
          </label>
          <label>
            区分A番号接頭辞
            <input name="groupAPrefix" defaultValue={String(numbering.groupAPrefix ?? "A")} />
          </label>
          <label>
            区分B番号接頭辞
            <input name="groupBPrefix" defaultValue={String(numbering.groupBPrefix ?? "B")} />
          </label>
          <label>
            番号の桁数
            <input name="numberDigits" type="number" min="1" max="6" defaultValue={Number(numbering.digits ?? 2)} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>運用・規約</legend>
        <div className="settings-grid">
          <label>
            席替え回数
            <input
              name="conversationRounds"
              type="number"
              min="1"
              max="20"
              defaultValue={settingNumber(settings, "conversationRounds")}
            />
          </label>
          <label>
            感情カードセットコード
            <input name="cardSetCode" defaultValue={settingString(settings, "cardSetCode")} />
          </label>
          <label>
            データ保存日数
            <input
              name="retentionDays"
              type="number"
              min="1"
              max="3650"
              defaultValue={settingNumber(settings, "retentionDays")}
            />
          </label>
          <label>
            イベント規約版
            <input name="eventTermsVersion" defaultValue={settingString(settings, "eventTermsVersion")} />
          </label>
          <label>
            プライバシーポリシー版
            <input name="privacyVersion" defaultValue={settingString(settings, "privacyVersion")} />
          </label>
        </div>
      </fieldset>

      {initial && transitionTargets.length > 0 && (
        <fieldset>
          <legend>イベント状態</legend>
          <p>
            現在: <strong>{getEventStatusLabel(initial.status)}</strong>
          </p>
          <label>
            変更先
            <select value={targetStatus} onChange={(event) => setTargetStatus(event.target.value)}>
              {transitionTargets.map((target) => (
                <option key={target} value={target}>
                  {EVENT_STATUS_LABELS[target]}
                </option>
              ))}
            </select>
          </label>
          <label>
            変更理由（状態を戻す場合は必須）
            <textarea value={transitionReason} onChange={(event) => setTransitionReason(event.target.value)} />
          </label>
          <button type="button" className="secondary" disabled={busy || !targetStatus} onClick={transitionStatus}>
            状態を変更
          </button>
        </fieldset>
      )}

      {message && <p role="status">{message}</p>}
      <div className="actions">
        <button disabled={busy}>{busy ? "保存中…" : mode === "create" ? "下書きイベントを作成" : "設定を保存"}</button>
        <a className="button-link secondary" href="/admin">
          管理トップへ戻る
        </a>
      </div>
      {initial && canDelete && initial.status === "draft" && (
        <fieldset>
          <legend>危険な操作</legend>
          <p>参加者、CSV取込、通知、席配置、結果のいずれかが存在するイベントは削除できません。</p>
          <button type="button" className="secondary" disabled={busy} onClick={deleteEvent}>
            下書きイベントを削除
          </button>
        </fieldset>
      )}
    </form>
  );
}
