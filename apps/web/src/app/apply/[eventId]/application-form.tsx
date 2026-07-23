"use client";

import { buildLiffApplicationLink } from "@shime/core/line/public-url";
import { useRef, useState, type FormEvent } from "react";

import { ParticipantNotice } from "../../../components/participant-ui";
import { APPLICATION_STEPS, type PublicApplicationField } from "../../../lib/application-form";

type EventSummary = Readonly<{
  startsAt: string;
  venueName: string;
  venueAddress: string;
  capacity: number;
}>;

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

function ApplicationFieldControl({ field }: Readonly<{ field: PublicApplicationField }>) {
  const required = field.requirement === "required";
  if (field.type === "select") {
    return (
      <select name={field.inputName} required={required}>
        <option value="">選択してください</option>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      name={field.inputName}
      type={field.type === "checkbox" ? "checkbox" : field.type}
      required={required}
      autoComplete={
        field.inputName === "fullName"
          ? "name"
          : field.inputName === "fullNameKana"
            ? "off"
            : field.inputName === "phone"
              ? "tel"
              : field.inputName === "email"
                ? "email"
                : field.inputName === "birthDate"
                  ? "bday"
                  : field.inputName === "nickname"
                    ? "nickname"
                    : field.inputName === "residenceArea"
                      ? "address-level2"
                      : undefined
      }
    />
  );
}

export function ApplicationForm({
  eventId,
  eventName,
  eventSummary,
  fields,
  liffId,
  consentVersions,
}: {
  eventId: string;
  eventName: string;
  eventSummary: EventSummary;
  fields: readonly PublicApplicationField[];
  liffId: string;
  consentVersions: { eventTerms: string; privacy: string };
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<Array<{ label: string; value: string }>>([]);
  const [linkToken, setLinkToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  function advance() {
    const form = formRef.current;
    const section = form?.querySelector<HTMLElement>(`[data-application-step="${step}"]`);
    if (!form || !section) return;
    const controls = Array.from(
      section.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea"),
    );
    const invalid = controls.find((control) => !control.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    if (step === 1) {
      const data = new FormData(form);
      if (!String(data.get("phone") ?? "").trim() && !String(data.get("email") ?? "").trim()) {
        setError("電話番号またはメールアドレスのどちらかを入力してください。");
        return;
      }
    }
    setError("");
    if (step === 2) {
      const data = new FormData(form);
      setConfirmation(
        fields.map((field) => {
          const raw = String(data.get(field.inputName) ?? "");
          const value =
            field.type === "select" ? (field.options.find((option) => option.value === raw)?.label ?? raw) : raw;
          return { label: field.label, value: value || "未入力" };
        }),
      );
    }
    setStep((current) => Math.min(current + 1, APPLICATION_STEPS.length - 1));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const application = Object.fromEntries(
      [
        "fullName",
        "fullNameKana",
        "phone",
        "email",
        "birthDate",
        "nickname",
        "residenceArea",
        "participantCategory",
      ].map((key) => [key, form.get(key) || undefined]),
    );
    try {
      const response = await fetch(`/api/public/events/${eventId}/applications`, {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          application,
          consents: [
            { type: "event_terms", documentVersion: consentVersions.eventTerms, accepted: true },
            { type: "privacy", documentVersion: consentVersions.privacy, accepted: true },
          ],
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError("申込みを完了できませんでした。入力内容と受付期間をご確認ください。");
        setBusy(false);
        return;
      }
      if (body.data.alreadyLinked) {
        setError("この申込みはすでにLINE本人連携済みです。");
        setBusy(false);
        return;
      }
      setLinkToken(body.data.linkToken);
    } catch {
      setError("通信を完了できませんでした。接続を確認して、もう一度お試しください。");
      setBusy(false);
    }
  }

  if (linkToken) {
    const liffLink = buildLiffApplicationLink(liffId, eventId, linkToken);
    return (
      <section className="panel application-complete">
        <p className="eyebrow">APPLICATION COMPLETE</p>
        <h1>申込みを受け付けました</h1>
        <p className="application-event-name">{eventName}</p>
        <ParticipantNotice tone="success">申込情報を安全に受け付けました。</ParticipantNotice>
        <h2>続いてLINE本人連携へ</h2>
        <p>同じスマートフォンからSHIME®を開き、本人連携を行ってください。</p>
        {liffLink ? (
          <>
            <div className="actions">
              <a className="button-link" href={liffLink}>
                LINEで本人連携へ
              </a>
              <a className="button-link secondary" href={liffLink} target="_blank" rel="noreferrer">
                別画面で開く
              </a>
              <button
                type="button"
                className="secondary"
                onClick={async () =>
                  setCopyMessage(
                    (await copyText(liffLink))
                      ? "本人連携リンクをコピーしました。"
                      : "コピーできません。LINEで開くをお試しください。",
                  )
                }
              >
                リンクをコピー
              </button>
            </div>
            <p className="hint">同じスマートフォンではQRコードの読み取りは不要です。</p>
            {copyMessage && <ParticipantNotice>{copyMessage}</ParticipantNotice>}
          </>
        ) : (
          <ParticipantNotice tone="error">LINE本人連携は現在準備中です。運営へご連絡ください。</ParticipantNotice>
        )}
      </section>
    );
  }

  return (
    <form ref={formRef} className="application" onSubmit={submit}>
      <header className="application-header">
        <p className="eyebrow">EMOKATSU APPLICATION</p>
        <h1>{eventName}</h1>
        <p>イベントへのお申込み</p>
        <nav className="application-progress" aria-label="申込みの進行">
          <ol>
            {APPLICATION_STEPS.map((item, index) => (
              <li
                key={item.key}
                className={index < step ? "complete" : ""}
                aria-current={index === step ? "step" : undefined}
              >
                <span>{index + 1}</span>
                {item.label}
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <section hidden={step !== 0} data-application-step="0">
        <h2>イベント概要・参加条件</h2>
        <dl className="application-event-summary">
          <dt>開催日時</dt>
          <dd>{eventSummary.startsAt}</dd>
          <dt>会場</dt>
          <dd>{eventSummary.venueName}</dd>
          <dt>住所</dt>
          <dd>{eventSummary.venueAddress}</dd>
          <dt>定員</dt>
          <dd>{eventSummary.capacity}名</dd>
        </dl>
        <label className="consent-choice application-confirmation-check">
          <input name="eligibilityConfirmed" type="checkbox" required />
          イベント概要と参加条件を確認しました
        </label>
      </section>

      <section hidden={step !== 1} data-application-step="1">
        <h2>申込情報</h2>
        <p className="hint">「必須」と表示された項目と、電話番号またはメールアドレスのどちらかを入力してください。</p>
        <div className="application-fields">
          {fields.map((field) => (
            <label key={field.fieldKey}>
              {field.label}
              {field.requirement === "required" && <span className="required-label">必須</span>}
              <ApplicationFieldControl field={field} />
            </label>
          ))}
        </div>
        {error && <ParticipantNotice tone="error">{error}</ParticipantNotice>}
      </section>

      <section hidden={step !== 2} data-application-step="2">
        <h2>規約・個人情報の同意</h2>
        <p>各文書を開いて内容を確認してください。同意日時と文書の版番号を保存します。</p>
        <label className="consent-choice application-confirmation-check">
          <input name="eventTermsAccepted" type="checkbox" required />
          <span>
            <a
              href={`/legal/${eventId}/event_terms?version=${encodeURIComponent(consentVersions.eventTerms)}`}
              target="_blank"
              rel="noreferrer"
            >
              イベント規約
            </a>
            に同意します
          </span>
        </label>
        <label className="consent-choice application-confirmation-check">
          <input name="privacyAccepted" type="checkbox" required />
          <span>
            <a
              href={`/legal/${eventId}/privacy?version=${encodeURIComponent(consentVersions.privacy)}`}
              target="_blank"
              rel="noreferrer"
            >
              プライバシーポリシー
            </a>
            に同意します
          </span>
        </label>
        <p className="participant-privacy">
          Dreamの公開や「9999人夢応援プロジェクト」への参加は、この申込みとは別に本人が選択できます。
        </p>
      </section>

      <section hidden={step !== 3} data-application-step="3">
        <h2>入力内容の確認</h2>
        <p>内容を確認し、申込みを確定してください。</p>
        <dl className="application-confirmation">
          {confirmation.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
        <p className="participant-privacy">申込み確定後、LINE本人連携へ進みます。</p>
        {error && <ParticipantNotice tone="error">{error}</ParticipantNotice>}
      </section>

      <nav className="application-actions" aria-label="申込み操作">
        {step > 0 && (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => {
              setError("");
              setStep((current) => current - 1);
            }}
          >
            戻る
          </button>
        )}
        {step < APPLICATION_STEPS.length - 1 ? (
          <button type="button" onClick={advance}>
            次へ
          </button>
        ) : (
          <button type="submit" disabled={busy}>
            {busy ? "送信中…" : "申込みを確定"}
          </button>
        )}
      </nav>
    </form>
  );
}
