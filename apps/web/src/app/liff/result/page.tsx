"use client";

import { useEffect, useState } from "react";
import { ParticipantNotice, ParticipantPageHeader } from "../../../components/participant-ui";
import { useLiffEventId } from "../../../lib/liff-location";

type Result = {
  available: boolean;
  matched?: boolean;
  matches?: Array<{ participantNumber: string | null; nickname: string | null }>;
};

export default function ResultPage() {
  const eventId = useLiffEventId();
  const [result, setResult] = useState<Result | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loaded" | "error">("idle");

  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/liff/events/${eventId}/result`)
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (!response.ok || !body.data) throw new Error();
        setResult(body.data);
      })
      .then(() => setLoadState("loaded"))
      .catch(() => setLoadState("error"));
  }, [eventId]);

  return <main><section className="panel participant-content">
    <ParticipantPageHeader eyebrow="CONNECTION" title="イベントからのご案内" description="運営責任者が確認した内容だけを、こちらでお知らせします。" current="result" eventId={eventId} />
    {eventId && loadState === "idle" && <ParticipantNotice>ご案内を確認しています…</ParticipantNotice>}
    {(!eventId || loadState === "error") && <ParticipantNotice tone="error">ご案内を確認できませんでした。LINEの案内から開き直してください。</ParticipantNotice>}
    {loadState === "loaded" && result && !result.available && <ParticipantNotice>ご案内はまだ準備中です。運営責任者の確認後に表示されます。</ParticipantNotice>}
    {result?.available && result.matched && <div className="connection-result">
      <p className="connection-message">お互いに「またお話ししたい」という気持ちが重なりました。</p>
      <ul>{result.matches?.map((match) => <li key={`${match.participantNumber}-${match.nickname}`}>{match.participantNumber} {match.nickname ?? "参加者"}</li>)}</ul>
      <p>連絡先交換は運営を通じてご案内します。</p>
    </div>}
    {result?.available && !result.matched && <div className="connection-result">
      <p className="connection-message">今日の出会いが、これからのつながりへの一歩になりますように。</p>
      <p>ご参加いただき、ありがとうございました。</p>
    </div>}
  </section></main>;
}
