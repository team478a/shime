"use client";

import { useEffect, useState, type FormEvent } from "react";
import liff from "@line/liff";
import { ParticipantNotice, ParticipantPageHeader } from "../../../components/participant-ui";
import { buildParticipantJourneyUrl } from "../../../lib/participant-journey";

export function LiffLinkClient({
  eventId,
  eventName,
  linkToken,
  liffId,
}: {
  eventId: string;
  eventName: string;
  linkToken: string;
  liffId: string;
}) {
  const [ready, setReady] = useState(false);
  const [linked, setLinked] = useState(false);
  const [error, setError] = useState("");
  const invalidError = !liffId || !eventId ? "LINE起動URLが正しくありません。" : "";

  useEffect(() => {
    if (!liffId || !eventId) return;
    void (async () => {
      try {
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }
        const idToken = liff.getIDToken();
        if (!idToken) throw new Error("ID_TOKEN_MISSING");
        const response = await fetch("/api/liff/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId, idToken }),
        });
        if (!response.ok) throw new Error("SESSION_FAILED");
        const body = await response.json();
        if (body.data.linked) setLinked(true);
        else if (linkToken) setReady(true);
        else setError("本人連携済みのLINEアカウントから開いてください。");
      } catch {
        setError("LINE認証を完了できませんでした。時間をおいて再度お試しください。");
      }
    })();
  }, [eventId, linkToken, liffId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/liff/applications/link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId,
        linkToken,
        phoneLastFour: form.get("phoneLastFour") || undefined,
        birthDate: form.get("birthDate") || undefined,
      }),
    });
    if (!response.ok) {
      setError("本人確認に失敗しました。入力内容またはURLの有効期限をご確認ください。");
      return;
    }
    setLinked(true);
  }

  if (linked)
    return (
      <main>
        <section className="panel">
          <ParticipantPageHeader
            eyebrow="WELCOME TO SHIME®"
            title="本人連携が完了しました"
            description="LINEとお申込み情報を安全に連携しました。イベントの準備へ進めます。"
          />
          {eventName && <p className="linked-event-name">{eventName}</p>}
          <ParticipantNotice tone="success">SHIME®をご利用いただけます。</ParticipantNotice>
          <a className="button-link" href={buildParticipantJourneyUrl("dream", eventId)}>
            Dream登録へ進む
          </a>
        </section>
      </main>
    );

  return (
    <main>
      <section className="panel">
        <ParticipantPageHeader
          eyebrow="WELCOME TO SHIME®"
          title="LINE本人連携"
          description="お申込み情報とLINEアカウントを安全に連携します。"
        />
        {eventName && <p className="linked-event-name">{eventName}</p>}
        {(invalidError || error) && <ParticipantNotice tone="error">{invalidError || error}</ParticipantNotice>}
        {!ready && !invalidError && !error && <ParticipantNotice>LINE認証を確認しています…</ParticipantNotice>}
        {ready && (
          <form onSubmit={submit} className="login-form">
            <p>申込時の電話番号下4桁、または生年月日を入力してください。</p>
            <label>
              電話番号下4桁
              <input name="phoneLastFour" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} />
            </label>
            <label>
              生年月日
              <input name="birthDate" type="date" />
            </label>
            <button>本人連携</button>
          </form>
        )}
      </section>
    </main>
  );
}
