"use client";

import { ParticipantNotice, ParticipantPageHeader } from "../../../components/participant-ui";
import { useEventResult } from "../../../hooks/use-event-result";
import { useLiffEventId } from "../../../lib/liff-location";

export default function ResultPage() {
  const eventId = useLiffEventId();
  const { result, loadState } = useEventResult(eventId);

  return (
    <main>
      <section className="panel participant-content">
        <ParticipantPageHeader
          eyebrow="CONNECTION"
          title="イベントからのご案内"
          description="運営責任者が確認した内容だけを、こちらでお知らせします。"
          current="result"
          eventId={eventId}
        />
        {eventId && loadState === "idle" && <ParticipantNotice>ご案内を確認しています…</ParticipantNotice>}
        {(!eventId || loadState === "error") && (
          <ParticipantNotice tone="error">
            ご案内を確認できませんでした。LINEの案内から開き直してください。
          </ParticipantNotice>
        )}
        {loadState === "loaded" && result && !result.available && (
          <ParticipantNotice>ご案内はまだ準備中です。運営責任者の確認後に表示されます。</ParticipantNotice>
        )}
        {result?.available && result.matched && (
          <div className="connection-result">
            <p className="connection-message">お互いに「またお話ししたい」という気持ちが重なりました。</p>
            <ul className="connection-match-list">
              {result.matches?.map((match) => (
                <li key={match.matchCandidateId}>
                  <span>
                    {match.participantNumber} {match.nickname ?? "参加者"}
                  </span>
                  {result.matchChatEnabled && (
                    <a
                      className="button-link"
                      href={`/liff/chat?${new URLSearchParams({ eventId, matchCandidateId: match.matchCandidateId }).toString()}`}
                    >
                      チャットを開く
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <p>
              {result.matchChatEnabled
                ? "チャットは双方の同意後、結果公開から72時間利用できます。"
                : "連絡先交換は運営を通じてご案内します。"}
            </p>
          </div>
        )}
        {result?.available && !result.matched && (
          <div className="connection-result">
            <p className="connection-message">今日の出会いが、これからのつながりへの一歩になりますように。</p>
            <p>ご参加いただき、ありがとうございました。</p>
          </div>
        )}
      </section>
    </main>
  );
}
