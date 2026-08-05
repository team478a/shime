"use client";

import { ParticipantNotice, ParticipantPageHeader } from "../../../components/participant-ui";
import { useInteractionMemo } from "../../../hooks/use-interaction-memo";
import { formatInteractionMemoSavedAt, interactionMemoTargetKey } from "../../../lib/interaction-memo-client";
import { useLiffEventId } from "../../../lib/liff-location";

export default function InteractionMemoPage() {
  const eventId = useLiffEventId();
  const memo = useInteractionMemo(eventId);
  const workspace = memo.workspace;

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
        {memo.loadStatus === "loaded" && workspace?.enabled && workspace.targets.length === 0 && (
          <ParticipantNotice>会話相手が登録されると、ここに参加者番号が表示されます。</ParticipantNotice>
        )}

        {workspace?.enabled && workspace.targets.length > 0 && (
          <div className="interaction-memo-list">
            {workspace.targets.map((target) => {
              const key = interactionMemoTargetKey(target);
              const saveState = memo.saveStates[key];
              const status = saveState?.status ?? (target.note ? "saved" : "idle");
              const label = target.participantNumber ?? "番号確認中";
              return (
                <article className="interaction-memo-card" key={key} aria-labelledby={`interaction-${key}`}>
                  <div className="interaction-memo-card-heading">
                    <h2 id={`interaction-${key}`}>{label}との会話</h2>
                    {target.roundNo !== null && <span>会話 {target.roundNo}</span>}
                  </div>
                  <p>あなたが感じたことを1つ選んでください。</p>
                  <div className="interaction-feeling-grid">
                    {workspace.options.map((option) => (
                      <button
                        type="button"
                        key={option.code}
                        className="interaction-feeling-button"
                        aria-pressed={target.note?.feelingCode === option.code}
                        onClick={() => memo.selectFeeling(target, option.code)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="interaction-favorite-button secondary"
                    aria-pressed={target.note?.favorite ?? false}
                    disabled={!target.note?.feelingCode}
                    onClick={() => memo.toggleFavorite(target)}
                  >
                    {target.note?.favorite ? "★ お気に入り" : "☆ お気に入り"}
                  </button>
                  <div className="interaction-save-status" aria-live="polite">
                    {status === "idle" && <span>未入力</span>}
                    {status === "saving" && <span>保存中…</span>}
                    {status === "saved" && (
                      <span>
                        保存済み{target.note?.savedAt ? ` ${formatInteractionMemoSavedAt(target.note.savedAt)}` : ""}
                      </span>
                    )}
                    {(status === "error" || status === "conflict") && (
                      <>
                        <span role="alert">{saveState?.message}</span>
                        <button type="button" className="secondary" onClick={() => memo.retry(target)}>
                          {status === "conflict" ? "最新の内容を確認" : "再試行"}
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {eventId && (
          <a className="button-link secondary" href={`/liff/passport?${new URLSearchParams({ eventId }).toString()}`}>
            SHIME® PASSへ戻る
          </a>
        )}
      </section>
    </main>
  );
}
