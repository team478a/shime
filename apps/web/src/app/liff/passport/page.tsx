"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { formatQrPayload } from "@shime/core/passport/rules";
import { ParticipantNotice, ParticipantPageHeader } from "../../../components/participant-ui";
import { getPassportStatusLabel } from "../../../lib/status-labels";
import { useLiffEventId } from "../../../lib/liff-location";

type Passport = { participantNumber: string; status: string };

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

export default function PassportPage() {
  const eventId = useLiffEventId();
  const [passport, setPassport] = useState<Passport | null>(null);
  const [qr, setQr] = useState("");
  const [qrPayload, setQrPayload] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [message, setMessage] = useState("");
  const [loadState, setLoadState] = useState<"idle" | "loaded" | "error">("idle");
  const [busyAction, setBusyAction] = useState<"passport" | "qr" | "">("");

  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/liff/me/passport/${eventId}`)
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (response.ok) setPassport(body.data);
        if (!response.ok && response.status !== 404) throw new Error();
      })
      .then(() => setLoadState("loaded"))
      .catch(() => setLoadState("error"));
  }, [eventId]);

  async function issue() {
    setBusyAction("passport");
    setMessage("");
    try {
      const response = await fetch(`/api/liff/events/${eventId}/passport`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        setMessage(
          body.code === "DREAM_REQUIREMENT_NOT_SATISFIED"
            ? "先に夢登録を完了してください。"
            : body.code === "QUESTIONNAIRE_NOT_SUBMITTED"
              ? "先に席案内の5問を提出してください。"
              : body.code === "QUESTIONNAIRE_NOT_CONFIGURED"
                ? "運営側で5問がまだ設定されていません。"
                : "SHIME® PASSを発行できませんでした。",
        );
        return;
      }
      setPassport(body.data);
    } catch {
      setMessage("通信できませんでした。接続を確認してください。");
    } finally {
      setBusyAction("");
    }
  }

  async function issueQr() {
    setBusyAction("qr");
    setMessage("");
    try {
      const response = await fetch(`/api/liff/events/${eventId}/passport/qr`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        setMessage("受付QRを発行できませんでした。参加者番号での手動受付も利用できます。");
        return;
      }
      const payload = formatQrPayload(body.data.qrToken);
      const dataUrl = await QRCode.toDataURL(payload, { width: 480, margin: 3, errorCorrectionLevel: "M" });
      setQrPayload(payload);
      setExpiresAt(
        new Date(body.data.expiresAt).toLocaleString("ja-JP", {
          timeZone: "Asia/Tokyo",
          dateStyle: "short",
          timeStyle: "short",
        }),
      );
      setQr(dataUrl);
    } catch {
      setMessage("受付QRを表示できませんでした。参加者番号で手動受付をご利用ください。");
    } finally {
      setBusyAction("");
    }
  }

  return (
    <main>
      <section className="panel participant-pass participant-content">
        <ParticipantPageHeader
          eyebrow="SHIME® PASS"
          title="SHIME® PASS"
          description="イベント参加の準備状況と、当日の受付情報をまとめています。"
          current="pass"
          eventId={eventId}
        />
        {eventId && loadState === "idle" && <ParticipantNotice>SHIME® PASSを確認しています…</ParticipantNotice>}
        {(!eventId || loadState === "error") && (
          <ParticipantNotice tone="error">
            SHIME® PASSを確認できませんでした。LINEの案内から開き直してください。
          </ParticipantNotice>
        )}
        {loadState === "loaded" && !passport && (
          <button onClick={issue} disabled={Boolean(busyAction)}>
            {busyAction === "passport" ? "発行中…" : "SHIME® PASSを発行"}
          </button>
        )}
        {passport && (
          <>
            <dl className="pass-details">
              <dt>参加者番号</dt>
              <dd>{passport.participantNumber}</dd>
              <dt>準備状況</dt>
              <dd>{getPassportStatusLabel(passport.status)}</dd>
            </dl>
            <button onClick={issueQr} disabled={Boolean(busyAction)}>
              {busyAction === "qr" ? "QR生成中…" : qr ? "QRを再発行" : "受付QRを表示"}
            </button>
            {qr && (
              <div className="qr-section">
                <Image
                  className="passport-qr"
                  src={qr}
                  alt="受付用QRコード"
                  width={480}
                  height={480}
                  unoptimized
                  priority
                />
                <p className="qr-expiry">有効期限: {expiresAt}（日本時間）</p>
                <div className="actions">
                  <a className="button-link secondary" href={qr} target="_blank" rel="noreferrer">
                    QR画像を別画面で開く
                  </a>
                  <a
                    className="button-link secondary"
                    href={qr}
                    download={`shime-reception-${passport.participantNumber}.png`}
                  >
                    QR画像を保存
                  </a>
                  <button
                    type="button"
                    className="secondary"
                    onClick={async () =>
                      setMessage(
                        (await copyText(qrPayload))
                          ? "受付コードをコピーしました。"
                          : "コピーできません。参加者番号で手動受付をお願いします。",
                      )
                    }
                  >
                    受付コードをコピー
                  </button>
                </div>
                <p className="participant-privacy">
                  スタッフの確認画面で受付が確定します。QRが表示できない場合は、参加者番号をスタッフに伝えて手動受付を利用してください。
                </p>
              </div>
            )}
          </>
        )}
        {message && <ParticipantNotice>{message}</ParticipantNotice>}
      </section>
    </main>
  );
}
