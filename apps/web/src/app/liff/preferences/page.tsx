"use client";

import { useEffect, useState } from "react";
import { ParticipantNotice, ParticipantPageHeader } from "../../../components/participant-ui";
import { useLiffEventId } from "../../../lib/liff-location";

type Candidate = { id: string; participantNumber: string | null; nickname: string | null };
type Choice = { toParticipantId: string; rank: number | null; privateNote: string | null };

export default function PreferencesPage() {
  const eventId = useLiffEventId();
  const [mode, setMode] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loadState, setLoadState] = useState<"idle" | "loaded" | "error">("idle");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!eventId) {
      return;
    }
    fetch(`/api/liff/events/${eventId}/preference-options`)
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (!response.ok) throw new Error();
        setMode(body.data.mode);
        setCandidates(body.data.candidates);
        const choices = [...body.data.choices].sort((a: Choice, b: Choice) => (a.rank ?? 0) - (b.rank ?? 0));
        setSelected(choices.map((choice: Choice) => choice.toParticipantId));
        setNotes(Object.fromEntries(choices.map((choice: Choice) => [choice.toParticipantId, choice.privateNote ?? ""])));
        setSubmitted(body.data.submissionStatus === "submitted");
      })
      .then(() => setLoadState("loaded"))
      .catch(() => setLoadState("error"));
  }, [eventId]);

  const max = mode === "ranked_up_to_3" ? 3 : mode === "mutual_up_to_2" ? 2 : 1;

  function toggle(id: string) {
    setSubmitted(false);
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length < max ? [...current, id] : current);
  }

  async function save() {
    setBusy(true);
    const choices = selected.map((participantId, index) => ({
      participantId,
      rank: mode === "ranked_up_to_3" ? index + 1 : null,
      privateNote: notes[participantId] || null,
    }));
    try {
      const response = await fetch(`/api/liff/events/${eventId}/preferences`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ choices }),
      });
      setMessage(response.ok ? "途中保存しました。" : "保存できませんでした。時間をおいてもう一度お試しください。");
      return response.ok;
    } catch {
      setMessage("通信できませんでした。接続を確認してください。");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!await save()) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/liff/events/${eventId}/preferences/submit`, { method: "POST" });
      setSubmitted(response.ok);
      setMessage(response.ok ? "希望を提出しました。締切までは変更できます。" : "提出できませんでした。締切時刻と入力内容を確認してください。");
    } catch {
      setMessage("通信できませんでした。接続を確認してください。");
    } finally {
      setBusy(false);
    }
  }

  return <main><section className="panel wide questionnaire participant-content">
    <ParticipantPageHeader eyebrow="PREFERENCE" title="またお話ししたい方" description="イベントで感じた気持ちを、ご自身のペースで選択できます。" current="preference" eventId={eventId} />
    <p className="participant-privacy">0名でも提出できます。選択内容・順位・メモは相手へ公開されません。</p>
    {eventId && loadState === "idle" && <ParticipantNotice>候補を読み込んでいます…</ParticipantNotice>}
    {(!eventId || loadState === "error") && <ParticipantNotice tone="error">希望入力期間外、または候補を読み込めませんでした。</ParticipantNotice>}
    {loadState === "loaded" && <>
      {mode === "ranked_up_to_3" && <p>選んだ順が希望順位になります（最大3名）。</p>}
      <div className="card-grid participant-choice-grid">{candidates.map((candidate) => {
        const index = selected.indexOf(candidate.id);
        return <div className={index >= 0 ? "emotion-card selected" : "emotion-card"} key={candidate.id}>
          <button type="button" className={index >= 0 ? "secondary" : ""} onClick={() => toggle(candidate.id)} disabled={busy}>
            {index >= 0 && mode === "ranked_up_to_3" ? `${index + 1}位 ` : ""}{candidate.participantNumber} {candidate.nickname ?? "参加者"}
          </button>
          {index >= 0 && <textarea aria-label="運営だけが確認するメモ" placeholder="任意メモ（相手には非公開）" value={notes[candidate.id] ?? ""} onChange={(event) => setNotes((old) => ({ ...old, [candidate.id]: event.target.value }))} maxLength={1000} />}
        </div>;
      })}</div>
      {candidates.length === 0 && <p className="participant-empty">現在選択できる方はいません。「今回は選ばない」として提出できます。</p>}
      <div className="actions">
        <button type="button" className="secondary" onClick={save} disabled={busy}>{busy ? "保存中…" : "途中保存"}</button>
        <button type="button" onClick={submit} disabled={busy}>{selected.length ? "この内容で提出" : "今回は選ばず提出"}</button>
      </div>
    </>}
    {submitted && <ParticipantNotice tone="success">提出済みです。</ParticipantNotice>}
    {message && <ParticipantNotice>{message}</ParticipantNotice>}
  </section></main>;
}
