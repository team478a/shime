"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  buildCheckinCancellationReason,
  CHECKIN_CANCELLATION_REASONS,
  type CheckinCancellationReason,
} from "@shime/core/checkin/cancellation";
import { getParticipantStatusLabel } from "../../../../../lib/status-labels";
import { getCheckinSearchFailure } from "../../../../../lib/checkin-feedback";

type Preview = {
  participantId: string;
  participantNumber: string;
  fullName: string;
  participantStatus: string;
  alreadyCheckedIn: boolean;
  checkedInAt?: string;
};

export function CheckinConsole({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [candidates, setCandidates] = useState<Preview[]>([]);
  const [method, setMethod] = useState<"qr" | "manual">("qr");
  const [message, setMessage] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelPreset, setCancelPreset] = useState<CheckinCancellationReason>("参加者都合");
  const [cancelNote, setCancelNote] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualMessage, setManualMessage] = useState("");
  const [manualError, setManualError] = useState(false);
  const [manualRequiresLogin, setManualRequiresLogin] = useState(false);
  const scannerRef = useRef<{ stop(): Promise<void>; clear(): void } | null>(null);

  async function lookupQr(qrToken: FormDataEntryValue | string | null) {
    const response = await fetch(`/api/admin/events/${eventId}/checkins/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ qrToken }),
    });
    const body = await response.json();
    if (response.ok) {
      setPreview(body.data);
      setCandidates([]);
      setMethod("qr");
      setMessage("");
    } else setMessage("QRが無効または期限切れです。");
  }

  async function scan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await lookupQr(new FormData(event.currentTarget).get("qrToken"));
  }

  async function startCamera() {
    setMessage("");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      setScanning(true);
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          await scanner.stop();
          scanner.clear();
          scannerRef.current = null;
          setScanning(false);
          await lookupQr(decodedText);
        },
        () => undefined,
      );
    } catch {
      setScanning(false);
      setMessage("カメラを開始できません。下の入力欄または手動受付をご利用ください。");
    }
  }

  async function stopCamera() {
    await scannerRef.current?.stop().catch(() => undefined);
    scannerRef.current?.clear();
    scannerRef.current = null;
    setScanning(false);
  }

  async function searchManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get("query") ?? "").trim();
    setManualBusy(true);
    setManualMessage("検索しています…");
    setManualError(false);
    setManualRequiresLogin(false);
    setCandidates([]);
    setPreview(null);
    try {
      const response = await fetch(`/api/admin/events/${eventId}/checkins/manual`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body) {
        const failure = getCheckinSearchFailure(response.status);
        setManualMessage(failure.message);
        setManualError(true);
        setManualRequiresLogin(failure.requiresLogin);
        return;
      }
      const found = (body.data?.candidates ?? []) as Preview[];
      setCandidates(found);
      setManualMessage(
        found.length
          ? `${found.length}件見つかりました。下の候補を選んでください。`
          : "該当する参加者が見つかりませんでした。入力を短くしてお試しください。",
      );
    } catch {
      const failure = getCheckinSearchFailure(0);
      setManualMessage(failure.message);
      setManualError(true);
      setManualRequiresLogin(false);
    } finally {
      setManualBusy(false);
    }
  }

  function selectCandidate(candidate: Preview) {
    setPreview(candidate);
    setCandidates([]);
    setMethod("manual");
    setCancelOpen(false);
    setManualMessage(`${candidate.participantNumber} ${candidate.fullName}さんを選択しました。`);
    setMessage("");
  }

  async function confirm() {
    if (!preview || !window.confirm(`${preview.fullName}さんの受付を確定しますか？`)) return;
    const response = await fetch(`/api/admin/events/${eventId}/checkins/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ participantId: preview.participantId, method }),
    });
    setMessage(response.ok ? "受付を確定しました。" : "すでに受付済みです。");
    if (response.ok) setPreview({ ...preview, alreadyCheckedIn: true });
  }

  async function cancel() {
    if (!preview) return;
    let reason: string;
    try {
      reason = buildCheckinCancellationReason(cancelPreset, cancelNote);
    } catch {
      setMessage("「その他」を選んだ場合は補足を入力してください。");
      return;
    }
    if (!window.confirm(`${preview.fullName}さんの受付を「${reason}」で取り消しますか？`)) return;
    setCancelBusy(true);
    const response = await fetch(`/api/admin/events/${eventId}/checkins/${preview.participantId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setCancelBusy(false);
    if (response.ok) {
      setMessage("受付を取り消しました。");
      setPreview({ ...preview, alreadyCheckedIn: false });
      setCancelOpen(false);
      setCancelNote("");
    } else {
      setMessage("受付を取り消せませんでした。状態を確認して、もう一度お試しください。");
    }
  }

  return (
    <div className="admin-stack">
      <section className="panel wide">
        <h1>当日受付</h1>
        <p className="current-operation-event">
          <span>受付対象イベント</span>
          <strong>{eventName}</strong>
        </p>
        <h2>QR受付</h2>
        <div id="qr-reader" className="qr-reader" />
        {scanning ? (
          <button className="secondary" onClick={stopCamera}>
            カメラを停止
          </button>
        ) : (
          <button onClick={startCamera}>カメラでQRを読む</button>
        )}
        <form className="login-form" onSubmit={scan}>
          <label>
            スキャナー入力／QR読取値
            <input name="qrToken" placeholder="SHIME1:..." required />
          </label>
          <button>参加者確認</button>
        </form>
      </section>

      <section className="panel wide">
        <h2>参加者検索・手動受付</h2>
        <p>参加者番号は先頭の文字から、氏名は一部の文字から検索できます。</p>
        <form className="login-form" onSubmit={searchManual}>
          <label>
            参加者番号または氏名
            <input name="query" placeholder="例: A / A01 / テスト参加者" required />
          </label>
          <button disabled={manualBusy}>{manualBusy ? "検索中…" : "検索"}</button>
        </form>
        {manualMessage && (
          <div
            className={`operation-feedback${manualError ? " operation-feedback-error" : ""}`}
            role={manualError ? "alert" : "status"}
            aria-live="polite"
          >
            <p>{manualMessage}</p>
            {manualRequiresLogin && (
              <a className="button-link" href="/admin/login">
                再ログインする
              </a>
            )}
          </div>
        )}
        {candidates.length > 0 && (
          <div className="admin-card-list">
            {candidates.map((candidate) => (
              <article className="admin-list-card" key={candidate.participantId}>
                <div>
                  <strong>{candidate.participantNumber}</strong>
                  <span>{candidate.fullName}</span>
                </div>
                <dl>
                  <dt>参加状態</dt>
                  <dd>{getParticipantStatusLabel(candidate.participantStatus)}</dd>
                  <dt>受付</dt>
                  <dd>{candidate.alreadyCheckedIn ? "受付済み" : "未受付"}</dd>
                </dl>
                <button type="button" onClick={() => selectCandidate(candidate)}>
                  この参加者を確認
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {preview && (
        <section className="panel wide">
          <h2>受付確認</h2>
          <dl>
            <dt>氏名</dt>
            <dd>{preview.fullName}</dd>
            <dt>参加者番号</dt>
            <dd>{preview.participantNumber}</dd>
            <dt>参加状態</dt>
            <dd>{getParticipantStatusLabel(preview.participantStatus)}</dd>
            <dt>受付</dt>
            <dd>{preview.alreadyCheckedIn ? "受付済み" : "未受付"}</dd>
          </dl>
          {preview.alreadyCheckedIn ? (
            <button className="secondary" onClick={() => setCancelOpen((current) => !current)}>
              受付を取り消す
            </button>
          ) : (
            <button onClick={confirm}>受付を確定</button>
          )}
          {preview.alreadyCheckedIn && cancelOpen && (
            <fieldset>
              <legend>受付取消理由</legend>
              <label>
                理由
                <select
                  value={cancelPreset}
                  onChange={(event) => setCancelPreset(event.target.value as CheckinCancellationReason)}
                >
                  {CHECKIN_CANCELLATION_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                補足（任意）
                <textarea
                  value={cancelNote}
                  onChange={(event) => setCancelNote(event.target.value)}
                  maxLength={900}
                  placeholder={cancelPreset === "その他" ? "その他の場合は必須" : "必要な場合だけ入力"}
                />
              </label>
              <div className="actions">
                <button type="button" disabled={cancelBusy} onClick={cancel}>
                  {cancelBusy ? "取消処理中…" : "理由を確認して取り消す"}
                </button>
                <button type="button" className="secondary" disabled={cancelBusy} onClick={() => setCancelOpen(false)}>
                  閉じる
                </button>
              </div>
            </fieldset>
          )}
        </section>
      )}

      {message && (
        <section className="panel wide">
          <p role="status">{message}</p>
        </section>
      )}
    </div>
  );
}
