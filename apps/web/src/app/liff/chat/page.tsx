"use client";

import { type FormEvent, useState } from "react";
import { ParticipantNotice, ParticipantPageHeader } from "../../../components/participant-ui";
import { useMatchChat } from "../../../hooks/use-match-chat";
import { useLiffEventId, useLiffMatchCandidateId } from "../../../lib/liff-location";

const reportCategories = [
  ["harassment", "嫌がらせ"],
  ["spam", "繰り返し・迷惑な送信"],
  ["inappropriate", "不適切な内容"],
  ["safety_concern", "安全上の心配"],
  ["other", "その他"],
] as const;

function formatJst(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

type ChatState = ReturnType<typeof useMatchChat>;

function ConsentPanel({ chat }: Readonly<{ chat: ChatState }>) {
  if (chat.room?.status !== "pending_consent") return null;
  return (
    <section className="match-chat-consent" aria-labelledby="chat-consent-title">
      <h2 id="chat-consent-title">チャット利用前の確認</h2>
      <ul>
        <li>相手が不快になる内容、勧誘、個人情報の強要は禁止です。</li>
        <li>安全のため、ブロック・通報ができます。</li>
        <li>メッセージは暗号化保存し、設定された保存期間後に削除対象となります。</li>
        <li>利用条件：{chat.room.termsVersion}</li>
      </ul>
      <button type="button" disabled={chat.room.participantConsented} onClick={chat.acceptTerms}>
        {chat.room.participantConsented ? "同意済み・お相手の同意待ち" : "内容に同意してチャットを開始"}
      </button>
      <p className="participant-hint">双方が同意するまでメッセージは送信できません。</p>
    </section>
  );
}

function OpenChat({ chat }: Readonly<{ chat: ChatState }>) {
  const [draft, setDraft] = useState("");
  if (chat.room?.status !== "open") return null;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await chat.send(draft)) setDraft("");
  };
  return (
    <>
      <div className="match-chat-messages" aria-live="polite" aria-label="メッセージ一覧">
        {chat.messages.length === 0 && <ParticipantNotice>まだメッセージはありません。</ParticipantNotice>}
        {chat.messages.map((message) => (
          <article className={`match-chat-message match-chat-message-${message.sender}`} key={message.id}>
            <p>{message.body}</p>
            <time dateTime={message.sentAt}>{formatJst(message.sentAt)}</time>
          </article>
        ))}
      </div>
      <form className="match-chat-composer" onSubmit={submit}>
        <label htmlFor="match-chat-message">メッセージ</label>
        <textarea
          id="match-chat-message"
          maxLength={chat.room.maxMessageLength}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="相手を思いやる内容を入力してください"
          rows={3}
          value={draft}
        />
        <div className="match-chat-composer-meta">
          <span>
            {draft.length}/{chat.room.maxMessageLength}
          </span>
          <button type="submit" disabled={chat.sending || !draft.trim()}>
            {chat.sending ? "送信中…" : "送信"}
          </button>
        </div>
      </form>
    </>
  );
}

function SafetyActions({ chat }: Readonly<{ chat: ChatState }>) {
  const [showSafety, setShowSafety] = useState(false);
  const [reportCategory, setReportCategory] = useState("safety_concern");
  const [reportDetail, setReportDetail] = useState("");
  if (!chat.room || chat.room.status === "blocked" || chat.room.status === "closed") return null;
  const confirmBlock = async () => {
    if (!window.confirm("このチャットを停止します。停止後は双方とも送信できません。よろしいですか？")) return;
    await chat.block();
  };
  const submitReport = async (event: FormEvent) => {
    event.preventDefault();
    if (!window.confirm("通報するとチャットは直ちに停止します。送信してよろしいですか？")) return;
    if (await chat.report(reportCategory, reportDetail)) setShowSafety(false);
  };
  return (
    <section className="match-chat-safety-actions">
      <button type="button" className="secondary" onClick={() => setShowSafety((current) => !current)}>
        安全・通報メニュー
      </button>
      {showSafety && (
        <div className="match-chat-safety-panel">
          <button type="button" className="secondary" onClick={confirmBlock}>
            このチャットをブロック
          </button>
          <form onSubmit={submitReport}>
            <label htmlFor="match-chat-report-category">通報理由</label>
            <select
              id="match-chat-report-category"
              onChange={(event) => setReportCategory(event.target.value)}
              value={reportCategory}
            >
              {reportCategories.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label htmlFor="match-chat-report-detail">補足（任意）</label>
            <textarea
              id="match-chat-report-detail"
              maxLength={1000}
              onChange={(event) => setReportDetail(event.target.value)}
              rows={3}
              value={reportDetail}
            />
            <button type="submit" className="danger-action">
              通報してチャットを停止
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

export default function MatchChatPage() {
  const eventId = useLiffEventId();
  const matchCandidateId = useLiffMatchCandidateId();
  const chat = useMatchChat(eventId, matchCandidateId);
  return (
    <main>
      <section className="panel participant-content match-chat-page">
        <ParticipantPageHeader
          eyebrow="SAFE CONNECTION"
          title="成立したお相手とのチャット"
          description="双方が同意した場合だけ、結果公開から72時間利用できます。"
          current="result"
          eventId={eventId}
        />
        {(!eventId || !matchCandidateId) && (
          <ParticipantNotice tone="error">結果画面からチャットを開き直してください。</ParticipantNotice>
        )}
        {chat.requestState === "loading" && <ParticipantNotice>チャットを準備しています…</ParticipantNotice>}
        {(chat.requestState === "unavailable" || chat.requestState === "error") && (
          <div className="match-chat-load-error">
            <ParticipantNotice tone="error">{chat.operationMessage}</ParticipantNotice>
            <button type="button" className="secondary" onClick={chat.loadRoom}>
              もう一度確認
            </button>
          </div>
        )}
        {chat.room && (
          <p className="match-chat-deadline">
            利用期限：<strong>{formatJst(chat.room.closesAt)}（日本時間）</strong>
          </p>
        )}
        <ConsentPanel chat={chat} />
        <OpenChat chat={chat} />
        {(chat.room?.status === "blocked" || chat.room?.status === "closed") && (
          <ParticipantNotice>このチャットは停止されています。</ParticipantNotice>
        )}
        {chat.operationMessage && chat.requestState === "ready" && (
          <ParticipantNotice tone={chat.room?.status === "blocked" ? "error" : "neutral"}>
            {chat.operationMessage}
          </ParticipantNotice>
        )}
        <SafetyActions chat={chat} />
        {eventId && (
          <a className="button-link secondary" href={`/liff/result?${new URLSearchParams({ eventId }).toString()}`}>
            結果画面へ戻る
          </a>
        )}
      </section>
    </main>
  );
}
