"use client";

import { useEffect, useState } from "react";
import { ParticipantNotice, ParticipantPageHeader } from "../../../components/participant-ui";
import { isQuestionnaireComplete, type QuestionnaireAnswer } from "../../../lib/participant-questionnaire";
import { useLiffEventId } from "../../../lib/liff-location";

type Option = { code: string; label: string };
type Question = { id: string; prompt: string; kind: string; maxSelections: number; options: Option[] };

export default function QuestionnairePage() {
  const eventId = useLiffEventId();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, QuestionnaireAnswer>>({});
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [loadState, setLoadState] = useState<"idle" | "loaded" | "error">("idle");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/liff/events/${eventId}/questionnaire`)
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (!response.ok) throw new Error();
        setQuestions(body.data.questions);
        setSubmitted(body.data.status === "submitted");
        setAnswers(
          Object.fromEntries(body.data.answers.map((answer: QuestionnaireAnswer) => [answer.questionId, answer])),
        );
      })
      .then(() => setLoadState("loaded"))
      .catch(() => setLoadState("error"));
  }, [eventId]);

  function toggle(question: Question, code: string) {
    setAnswers((current) => {
      const old = current[question.id] ?? { questionId: question.id, optionCodes: [], declined: false };
      const optionCodes = old.optionCodes.includes(code)
        ? old.optionCodes.filter((item) => item !== code)
        : question.maxSelections === 1
          ? [code]
          : [...old.optionCodes, code].slice(0, question.maxSelections);
      return { ...current, [question.id]: { questionId: question.id, optionCodes, declined: false } };
    });
  }

  function decline(questionId: string) {
    setAnswers((current) => ({
      ...current,
      [questionId]: { questionId, optionCodes: [], declined: !current[questionId]?.declined },
    }));
  }

  async function save() {
    setBusy(true);
    try {
      const response = await fetch(`/api/liff/events/${eventId}/questionnaire`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: Object.values(answers) }),
      });
      setMessage(response.ok ? "途中保存しました。" : "回答を保存できませんでした。入力内容を確認してください。");
      return response.ok;
    } catch {
      setMessage("通信できませんでした。接続を確認してください。");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (
      !isQuestionnaireComplete(
        questions.map((question) => question.id),
        answers,
      )
    ) {
      setMessage("5問すべてに回答するか「答えたくない」を選んでください。");
      return;
    }
    if (!(await save())) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/liff/events/${eventId}/questionnaire/submit`, { method: "POST" });
      if (response.ok) {
        setSubmitted(true);
        setMessage("回答を提出しました。SHIME® PASSの発行へ進めます。");
      } else {
        setMessage("回答を提出できませんでした。入力内容を確認してください。");
      }
    } catch {
      setMessage("通信できませんでした。接続を確認してください。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <section className="panel wide questionnaire participant-content">
        <ParticipantPageHeader
          eyebrow="SEATING GUIDE"
          title="席案内のための5問"
          description="心地よく会話できる席をご案内するための質問です。"
          current="questionnaire"
          eventId={eventId}
        />
        <p className="participant-privacy">回答は席配置の計算だけに使い、他の参加者には公開しません。</p>
        {eventId && loadState === "idle" && <ParticipantNotice>質問を読み込んでいます…</ParticipantNotice>}
        {(!eventId || loadState === "error") && (
          <ParticipantNotice tone="error">
            質問を読み込めませんでした。LINEの案内から開き直してください。
          </ParticipantNotice>
        )}
        {loadState === "loaded" && questions.length === 0 && (
          <ParticipantNotice>質問はまだ準備されていません。</ParticipantNotice>
        )}
        {loadState === "loaded" &&
          questions.map((question, index) => {
            const answer = answers[question.id];
            return (
              <fieldset key={question.id} disabled={submitted || busy}>
                <legend>
                  {index + 1}. {question.prompt}
                </legend>
                <div className="option-grid">
                  {question.options.map((option) => (
                    <label key={option.code} className="choice">
                      <input
                        type={question.maxSelections === 1 ? "radio" : "checkbox"}
                        name={question.id}
                        checked={answer?.optionCodes.includes(option.code) ?? false}
                        onChange={() => toggle(question, option.code)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                <label className="choice decline">
                  <input type="checkbox" checked={answer?.declined ?? false} onChange={() => decline(question.id)} />
                  答えたくない
                </label>
                <small>最大{question.maxSelections}個</small>
              </fieldset>
            );
          })}
        {loadState === "loaded" && questions.length > 0 && !submitted && (
          <div className="actions">
            <button type="button" className="secondary" onClick={save} disabled={busy}>
              {busy ? "保存中…" : "途中保存"}
            </button>
            <button type="button" onClick={submit} disabled={busy}>
              {busy ? "提出中…" : "5問を提出"}
            </button>
          </div>
        )}
        {submitted && (
          <a className="button-link" href={`/liff/passport?eventId=${eventId}`}>
            SHIME® PASSへ
          </a>
        )}
        {message && <ParticipantNotice>{message}</ParticipantNotice>}
      </section>
    </main>
  );
}
