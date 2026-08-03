"use client";

import { useMemo, useState } from "react";

import { ParticipantNextLink } from "../../../components/participant-journey-nav";
import { ParticipantNotice, ParticipantPageHeader } from "../../../components/participant-ui";
import { type DiagnosisAnswer, useDiagnosis } from "../../../hooks/use-diagnosis";
import { useLiffEventId } from "../../../lib/liff-location";

type Screen = "card" | "questions" | "confirm";

function seededCards<T extends { id: string }>(cards: T[], seed: string) {
  const result = [...cards];
  let value = [...seed].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 2166136261);
  for (let index = result.length - 1; index > 0; index -= 1) {
    value = (value * 1664525 + 1013904223) >>> 0;
    const target = value % (index + 1);
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
}

export default function DiagnosisPage() {
  const eventId = useLiffEventId();
  const { view, loadState, message, busy, start, selectCard, save, submit } = useDiagnosis(eventId);
  const [screen, setScreen] = useState<Screen>("card");
  const [selectedCardId, setSelectedCardId] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [syncedSessionKey, setSyncedSessionKey] = useState<string | null>(null);

  const session = view?.session ?? null;
  // Keyed on id + submittedAt (not revision) so a routine mid-editing save doesn't
  // re-run this and clobber the participant's in-progress card/answer selection;
  // it should only re-hydrate on a genuinely new or reopened answering attempt.
  const sessionKey = session ? `${session.id}:${session.submittedAt ?? "null"}` : null;
  if (session && sessionKey !== syncedSessionKey) {
    setSyncedSessionKey(sessionKey);
    setSelectedCardId(session.selectedCardAssetVersionId ?? "");
    setAnswers(Object.fromEntries((view?.answers ?? []).map((answer) => [answer.axisCode, answer.optionCode])));
    setScreen(session.selectedCardAssetVersionId ? "questions" : "card");
  }

  const cards = useMemo(
    () => seededCards(view?.diagnosis.cards ?? [], view?.session?.id ?? eventId),
    [eventId, view?.diagnosis.cards, view?.session?.id],
  );
  const selectedCard = view?.diagnosis.selectedCard?.id === selectedCardId ? view.diagnosis.selectedCard : null;
  const answerList: DiagnosisAnswer[] = Object.entries(answers).map(([axisCode, optionCode]) => ({
    axisCode,
    optionCode,
  }));
  const complete = Boolean(
    view?.diagnosis.questions.length &&
    view.diagnosis.questions.every((question) => Boolean(answers[question.axisCode])),
  );

  async function saveAndContinue() {
    if (!selectedCardId || !complete) return;
    const revision = await save(selectedCardId, answerList);
    if (revision !== null) setScreen("confirm");
  }

  async function completeDiagnosis() {
    if (!selectedCardId || !complete || !view?.session) return;
    const revision = await save(selectedCardId, answerList);
    if (revision !== null) await submit(revision);
  }

  return (
    <main>
      <section className="panel wide participant-content diagnosis-panel">
        <ParticipantPageHeader
          eyebrow="SHIME® CONCIERGE"
          title={view?.diagnosis.copy.pageTitle || "今の気持ちに近いカード"}
          description={view?.diagnosis.copy.intro || "今の自分を入口に、今日大切にしたいことを見つけます。"}
          current="diagnosis"
          eventId={eventId}
        />
        <p className="participant-privacy">
          回答と結果は他の参加者には公開されません。これは医学的・心理学的な診断ではありません。
        </p>

        {loadState === "idle" && <ParticipantNotice>診断を読み込んでいます…</ParticipantNotice>}
        {loadState === "error" && <ParticipantNotice tone="error">{message}</ParticipantNotice>}

        {loadState === "loaded" && view && !view.session && (
          <div className="diagnosis-intro">
            <p>{view.diagnosis.copy.instructions || "8枚のカードから、今の気持ちに近い1枚を選びます。"}</p>
            <button type="button" onClick={() => start()} disabled={busy}>
              {busy ? "準備中…" : view.diagnosis.copy.startButton || "SHIME診断を始める"}
            </button>
          </div>
        )}

        {view?.session?.status === "in_progress" && screen === "card" && (
          <div>
            <h2>直感で1枚選んでください</h2>
            <p>カードの位置は参加者ごとにシャッフルされています。</p>
            <div className="diagnosis-card-grid">
              {cards.map((card, index) => (
                <button
                  type="button"
                  className="diagnosis-card-back"
                  key={card.id}
                  disabled={busy}
                  onClick={async () => {
                    if (await selectCard(card.id, answerList)) {
                      setSelectedCardId(card.id);
                      setScreen("questions");
                    }
                  }}
                >
                  <span>SHIME®</span>
                  <strong>カード {index + 1}</strong>
                </button>
              ))}
            </div>
          </div>
        )}

        {view?.session?.status === "in_progress" && screen === "questions" && selectedCard && (
          <div>
            <div className="diagnosis-selected-card">
              <img src={selectedCard.imageUrl} alt={selectedCard.altText} />
              <div>
                <small>選んだカード</small>
                <h2>{selectedCard.title}</h2>
                <p>{selectedCard.message}</p>
              </div>
            </div>
            {view.diagnosis.questions.map((question, index) => (
              <fieldset key={question.axisCode} disabled={busy}>
                <legend>
                  {index + 1}. {question.prompt}
                </legend>
                {question.supplementalText && <p>{question.supplementalText}</p>}
                <div className="option-grid">
                  {question.options
                    .slice()
                    .sort((left, right) => left.displayOrder - right.displayOrder)
                    .map((option) => (
                      <label className="choice" key={option.code}>
                        <input
                          type="radio"
                          name={question.axisCode}
                          checked={answers[question.axisCode] === option.code}
                          onChange={() => setAnswers((current) => ({ ...current, [question.axisCode]: option.code }))}
                        />
                        {option.label}
                      </label>
                    ))}
                </div>
              </fieldset>
            ))}
            <div className="actions">
              <button type="button" className="secondary" onClick={() => setScreen("card")} disabled={busy}>
                カードを選び直す
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => save(selectedCardId, answerList)}
                disabled={busy}
              >
                {busy ? "保存中…" : "途中保存"}
              </button>
              <button type="button" onClick={saveAndContinue} disabled={busy || !complete}>
                {view.diagnosis.copy.nextButton || "確認へ進む"}
              </button>
            </div>
          </div>
        )}

        {view?.session?.status === "in_progress" && screen === "confirm" && selectedCard && (
          <div>
            <h2>回答内容を確認</h2>
            <div className="diagnosis-selected-card compact">
              <img src={selectedCard.imageUrl} alt={selectedCard.altText} />
              <strong>{selectedCard.title}</strong>
            </div>
            <dl className="diagnosis-answer-review">
              {view.diagnosis.questions.map((question) => (
                <div key={question.axisCode}>
                  <dt>{question.prompt}</dt>
                  <dd>
                    {question.options.find((option) => option.code === answers[question.axisCode])?.label ?? "未回答"}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="actions">
              <button type="button" className="secondary" onClick={() => setScreen("questions")} disabled={busy}>
                {view.diagnosis.copy.backButton || "回答へ戻る"}
              </button>
              <button type="button" onClick={completeDiagnosis} disabled={busy}>
                {busy ? "提出中…" : view.diagnosis.copy.completeButton || "この内容で提出"}
              </button>
            </div>
          </div>
        )}

        {view?.session?.status === "submitted" && view.result && (
          <div className="diagnosis-result">
            <p className="eyebrow">RULE-BASED RESULT</p>
            <h2>{view.diagnosis.reportCopy.title || view.diagnosis.copy.completionTitle || "今のあなたへのヒント"}</h2>
            <h3>{view.diagnosis.reportCopy.heading || view.result.primaryEmotion.label}</h3>
            <p>{view.result.supportMessage || view.result.card.message}</p>
            {view.result.primaryEmotion.description && <p>{view.result.primaryEmotion.description}</p>}
            {view.result.schemaVersion === 2 && view.result.theme && view.result.actionReadiness && (
              <dl className="diagnosis-answer-review">
                <div>
                  <dt>今日のテーマ</dt>
                  <dd>{view.result.theme.label}</dd>
                </div>
                <div>
                  <dt>行動準備度</dt>
                  <dd>{view.result.actionReadiness.label}</dd>
                </div>
              </dl>
            )}
            {view.diagnosis.reportCopy.fixedText && <p>{view.diagnosis.reportCopy.fixedText}</p>}
            <dl className="diagnosis-answer-review">
              {view.result.axes.map((axis) => (
                <div key={axis.axisCode}>
                  <dt>{axis.prompt}</dt>
                  <dd>{axis.optionLabel}</dd>
                </div>
              ))}
            </dl>
            {view.diagnosis.copy.completionBody && <p>{view.diagnosis.copy.completionBody}</p>}
            {view.diagnosis.reportCopy.guidance && <p>{view.diagnosis.reportCopy.guidance}</p>}
            <p className="participant-privacy">
              {view.diagnosis.reportCopy.disclaimer ||
                "この結果は自己理解を支援するためのもので、性格・相性・医学的状態を断定するものではありません。"}
            </p>
            <div className="actions">
              {view.access.allowResubmission && (
                <button type="button" className="secondary" onClick={() => start(true)} disabled={busy}>
                  回答を見直す
                </button>
              )}
              <ParticipantNextLink current="diagnosis" eventId={eventId} />
            </div>
          </div>
        )}

        {message && loadState !== "error" && <ParticipantNotice>{message}</ParticipantNotice>}
      </section>
    </main>
  );
}
