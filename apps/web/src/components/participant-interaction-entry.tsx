"use client";

import { useInteractionMemo } from "../hooks/use-interaction-memo";

export function ParticipantInteractionEntry({ eventId }: Readonly<{ eventId: string }>) {
  const memo = useInteractionMemo(eventId, Boolean(eventId));
  if (memo.loadStatus !== "loaded" || !memo.workspace?.enabled) return null;

  return (
    <div className="participant-interaction-entry">
      <p className="eyebrow">ONE TAP MEMO</p>
      <h2>会話メモ</h2>
      <p>話した相手ごとに、自分が感じたことを短時間で記録できます。</p>
      <a className="button-link" href={`/liff/interactions?${new URLSearchParams({ eventId }).toString()}`}>
        会話メモを開く
      </a>
    </div>
  );
}
