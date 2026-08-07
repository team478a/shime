"use client";

import { ParticipantNotice, ParticipantPageHeader } from "../../../components/participant-ui";
import { useInteractionMemo } from "../../../hooks/use-interaction-memo";
import { useInteractionTargetRegistration } from "../../../hooks/use-interaction-target-registration";
import { getDisplayableInteractionMemoTargets } from "../../../lib/interaction-memo-client";
import { useLiffEventId } from "../../../lib/liff-location";
import { InteractionMemoCard } from "./interaction-memo-card";
import { InteractionTargetRegistration } from "./interaction-target-registration";

export default function InteractionMemoPage() {
  const eventId = useLiffEventId();
  const memo = useInteractionMemo(eventId);
  const workspace = memo.workspace;
  const displayableTargets = getDisplayableInteractionMemoTargets(workspace);
  const registration = useInteractionTargetRegistration(eventId, memo.refresh);

  return (
    <main>
      <section className="panel participant-content interaction-memo-page">
        <ParticipantPageHeader
          eyebrow="ONE TAP MEMO"
          title="会話メモ"
          description="話した相手ごとに、今の気持ちを5〜10秒で記録できます。"
          current="pass"
          eventId={eventId}
        />
        <p className="participant-privacy">
          このメモはあなたにだけ表示されます。相手への通知、相手からの評価、人気順位には使いません。
        </p>

        {!eventId && (
          <ParticipantNotice tone="error">
            イベント情報を確認できません。LINEの案内から開き直してください。
          </ParticipantNotice>
        )}
        {eventId && memo.loadStatus === "loading" && <ParticipantNotice>会話相手を確認しています…</ParticipantNotice>}
        {memo.loadStatus === "error" && (
          <div className="interaction-memo-load-error">
            <ParticipantNotice tone="error">
              会話メモを読み込めませんでした。通信状態を確認してください。
            </ParticipantNotice>
            <button type="button" className="secondary" onClick={memo.refresh}>
              もう一度読み込む
            </button>
          </div>
        )}
        {memo.loadStatus === "loaded" && workspace && !workspace.enabled && (
          <ParticipantNotice>このイベントでは会話メモを利用できません。</ParticipantNotice>
        )}
        {memo.loadStatus === "loaded" && workspace?.enabled && displayableTargets.length === 0 && (
          <ParticipantNotice>
            参加者番号を確認できる会話相手が登録されると、ここにカードが表示されます。
          </ParticipantNotice>
        )}

        {workspace?.enabled && workspace.targetSource === "self_reported" && (
          <InteractionTargetRegistration registration={registration} />
        )}

        {workspace?.enabled && displayableTargets.length > 0 && (
          <div className="interaction-memo-list">
            {displayableTargets.map((target) => (
              <InteractionMemoCard
                key={`${target.interactionSlotId}:${target.targetParticipantId}`}
                eventId={eventId}
                memo={memo}
                options={workspace.options}
                registration={registration}
                target={target}
                targetSource={workspace.targetSource}
              />
            ))}
          </div>
        )}

        {eventId && (
          <div className="actions">
            <a className="button-link" href={`/liff/preferences?${new URLSearchParams({ eventId }).toString()}`}>
              イベント終了時の希望入力へ
            </a>
            <a className="button-link secondary" href={`/liff/passport?${new URLSearchParams({ eventId }).toString()}`}>
              SHIME® PASSへ戻る
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
