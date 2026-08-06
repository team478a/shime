"use client";

import type { useInteractionTargetRegistration } from "../../../hooks/use-interaction-target-registration";

type Props = {
  registration: ReturnType<typeof useInteractionTargetRegistration>;
};

export function InteractionTargetRegistration({ registration }: Props) {
  return (
    <section className="interaction-target-registration" aria-labelledby="interaction-target-title">
      <h2 id="interaction-target-title">話した相手を追加</h2>
      <p>相手の参加者番号の先頭を1文字以上入力してください。氏名は表示しません。</p>
      <div className="interaction-target-search">
        <label htmlFor="interaction-target-query">参加者番号</label>
        <input
          id="interaction-target-query"
          value={registration.query}
          maxLength={20}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="例: B / B0 / B03"
          onChange={(event) => registration.setQuery(event.target.value)}
        />
        <button type="button" onClick={registration.search} disabled={registration.status === "searching"}>
          {registration.status === "searching" ? "検索中…" : "候補を検索"}
        </button>
      </div>
      {registration.candidates.length > 0 && !registration.selected && (
        <div className="interaction-target-candidates" aria-label="参加者番号の候補">
          {registration.candidates.map((candidate) => (
            <button type="button" key={candidate.targetParticipantId} onClick={() => registration.choose(candidate)}>
              {candidate.participantNumber}
            </button>
          ))}
        </div>
      )}
      {registration.selected && (
        <div className="interaction-target-confirmation" role="group" aria-label="会話相手の確認">
          <strong>{registration.selected.participantNumber}でよいですか？</strong>
          <p>番号をもう一度確認してから追加してください。</p>
          <div>
            <button type="button" onClick={registration.confirm} disabled={registration.status === "saving"}>
              {registration.status === "saving" ? "追加中…" : "この番号でよい"}
            </button>
            <button type="button" className="secondary" onClick={registration.closeConfirmation}>
              選び直す
            </button>
          </div>
        </div>
      )}
      {registration.message && (
        <p className="interaction-target-message" aria-live="polite">
          {registration.message}
        </p>
      )}
      <p className="hint">番号が分からない場合は、受付スタッフへ確認してください。</p>
    </section>
  );
}
