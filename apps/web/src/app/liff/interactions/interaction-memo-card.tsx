"use client";

import { useState } from "react";
import type { useInteractionMemo } from "../../../hooks/use-interaction-memo";
import type { useInteractionTargetRegistration } from "../../../hooks/use-interaction-target-registration";
import {
  formatInteractionMemoSavedAt,
  type InteractionMemoOptionDto,
  type InteractionMemoTargetDto,
  interactionMemoTargetKey,
} from "../../../lib/interaction-memo-client";
import { InteractionPublicProfile } from "./interaction-public-profile";

type Props = {
  eventId: string;
  memo: ReturnType<typeof useInteractionMemo>;
  options: InteractionMemoOptionDto[];
  registration: ReturnType<typeof useInteractionTargetRegistration>;
  target: InteractionMemoTargetDto;
  targetSource: "interaction_slot" | "self_reported" | "operator_import" | undefined;
};

type SaveState = ReturnType<typeof useInteractionMemo>["saveStates"][string];

function InteractionSaveStatus({
  retry,
  saveState,
  target,
}: {
  retry: () => void;
  saveState: SaveState | undefined;
  target: InteractionMemoTargetDto;
}) {
  const status = saveState?.status ?? (target.note ? "saved" : "idle");
  return (
    <div className="interaction-save-status" aria-live="polite">
      {status === "idle" && <span>未入力</span>}
      {status === "saving" && <span>保存中…</span>}
      {status === "saved" && (
        <span>保存済み{target.note?.savedAt ? ` ${formatInteractionMemoSavedAt(target.note.savedAt)}` : ""}</span>
      )}
      {(status === "error" || status === "conflict") && (
        <>
          <span role="alert">{saveState?.message}</span>
          <button type="button" className="secondary" onClick={retry}>
            {status === "conflict" ? "最新の内容を確認" : "再試行"}
          </button>
        </>
      )}
    </div>
  );
}

export function InteractionMemoCard({ eventId, memo, options, registration, target, targetSource }: Props) {
  const key = interactionMemoTargetKey(target);
  const saveState = memo.saveStates[key];
  const [privateNoteDraft, setPrivateNoteDraft] = useState(target.note?.privateNoteText ?? "");
  return (
    <article className="interaction-memo-card" aria-labelledby={`interaction-${key}`}>
      <div className="interaction-memo-card-heading">
        <h2 id={`interaction-${key}`}>会話メモ</h2>
        {target.roundNo !== null && <span>会話 {target.roundNo}</span>}
      </div>
      <InteractionPublicProfile eventId={eventId} target={target} />
      <p>あなたが感じたことを1つ選んでください。</p>
      <div className="interaction-feeling-grid">
        {options.map((option) => (
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
      <div className="interaction-private-note">
        <label htmlFor={`private-note-${key}`}>本人専用メモ（120文字・3行まで）</label>
        <textarea
          id={`private-note-${key}`}
          value={privateNoteDraft}
          maxLength={120}
          rows={3}
          onChange={(event) => setPrivateNoteDraft(event.target.value.replace(/(?:\r?\n){3,}/g, "\n\n"))}
          placeholder="相手には表示されません"
        />
        <div>
          <span>{privateNoteDraft.length}/120</span>
          <button
            type="button"
            className="secondary"
            disabled={!target.note?.feelingCode || privateNoteDraft === (target.note?.privateNoteText ?? "")}
            onClick={() => memo.savePrivateNote(target, privateNoteDraft)}
          >
            メモを保存
          </button>
        </div>
      </div>
      <button
        type="button"
        className="interaction-talk-more-button"
        aria-pressed={target.note?.wantsToTalkMore ?? false}
        disabled={!target.note?.feelingCode}
        onClick={() => memo.toggleWantsToTalkMore(target)}
      >
        {target.note?.wantsToTalkMore ? "✓ もう少し話したいに保存しました" : "もう少し話したい"}
      </button>
      <p className="hint">この意思は本人だけの非公開情報です。相手への通知や自動マッチングは行いません。</p>
      <InteractionSaveStatus retry={() => memo.retry(target)} saveState={saveState} target={target} />
      {targetSource === "self_reported" && !target.note && (
        <button
          type="button"
          className="secondary interaction-target-cancel"
          disabled={registration.status === "cancelling"}
          onClick={() => registration.cancel(target)}
        >
          誤登録を取り消す
        </button>
      )}
    </article>
  );
}
