"use client";

import type { useInteractionTargetRegistration } from "../../../hooks/use-interaction-target-registration";
import { participantNumberDisplay } from "../../../lib/interaction-memo-client";

type Props = {
  registration: ReturnType<typeof useInteractionTargetRegistration>;
};

export function InteractionTargetRegistration({ registration }: Props) {
  return (
    <section className="interaction-target-registration" aria-labelledby="interaction-target-title">
      <h2 id="interaction-target-title">話した相手を追加</h2>
      <p>会話したお相手の番号を選んでください。氏名は表示しません。</p>
      <div className="interaction-target-search">
        <label htmlFor="interaction-target-query">番号で絞り込む（任意）</label>
        <input
          id="interaction-target-query"
          value={registration.query}
          maxLength={20}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="例: 3"
          onChange={(event) => registration.setQuery(event.target.value)}
        />
        <button type="button" onClick={registration.search} disabled={registration.status === "searching"}>
          {registration.status === "searching" ? "更新中…" : "一覧を更新"}
        </button>
      </div>
      {registration.candidates.length > 0 && !registration.selected && (
        <div className="interaction-target-candidates" aria-label="参加者番号の候補">
          {registration.candidates.map((candidate) => (
            <button type="button" key={candidate.targetParticipantId} onClick={() => registration.choose(candidate)}>
              {participantNumberDisplay(candidate.participantNumber)}
            </button>
          ))}
        </div>
      )}
      {registration.selected && (
        <div className="interaction-target-confirmation" role="group" aria-label="会話相手の確認">
          <strong>{participantNumberDisplay(registration.selected.participantNumber)}番でよいですか？</strong>
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
