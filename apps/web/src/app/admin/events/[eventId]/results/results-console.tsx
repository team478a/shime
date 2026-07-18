"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { filterResultCandidates, resultStatusClass, summarizeResultCandidates, type ResultStatusFilter } from "../../../../../lib/result-view";
import { getEventStatusLabel, getMatchCandidateStatusLabel } from "../../../../../lib/status-labels";

type Candidate = { id: string; participantAId: string; participantBId: string; aRank: number | null; bRank: number | null; status: string };
type Person = { id: string; participantNumber: string | null; fullName: string };
type Data = { eventName: string; eventStatus: string; preferenceMode: string; candidates: Candidate[]; participants: Person[]; submissionSummary: { submitted: number; total: number }; conflicts: string[][] };
type Preview = { targetCount: number; approvedCount: number; matchedParticipantCount: number; unmatchedParticipantCount: number; matchedText: string; unmatchedText: string };

export function ResultsConsole({ eventId, canDecide, canRevoke }: { eventId: string; canDecide: boolean; canRevoke: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ResultStatusFilter>("all");

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/events/${eventId}/match-candidates`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.code ?? "LOAD_FAILED");
    setData(body.data);
  }, [eventId]);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/events/${eventId}/match-candidates`)
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (!response.ok) throw new Error(body.code ?? "LOAD_FAILED");
        if (active) setData(body.data);
      })
      .catch(() => {
        if (active) setError("結果候補を読み込めませんでした。通信状態を確認して再読み込みしてください。");
      });
    return () => { active = false; };
  }, [eventId]);

  const people = useMemo(() => new Map(data?.participants.map((person) => [person.id, person])), [data]);
  const candidateSummary = useMemo(() => summarizeResultCandidates(data?.candidates ?? []), [data]);
  const visibleCandidates = useMemo(() => filterResultCandidates(data?.candidates ?? [], data?.participants ?? [], query, statusFilter), [data, query, statusFilter]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try { await action(); }
    catch { setError("操作を完了できませんでした。通信状態を確認し、状態を再読み込みしてください。"); }
    finally { setBusy(false); }
  }

  async function transition(status: string) {
    await run(async () => {
      const response = await fetch(`/api/admin/events/${eventId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.code);
      setMessage("イベント状態を変更しました。");
      await load();
    });
  }

  async function decide(id: string, status: string) {
    await run(async () => {
      const response = await fetch(`/api/admin/events/${eventId}/match-candidates/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.code);
      setMessage("候補の判定を保存しました。");
      await load();
    });
  }

  async function confirmResults() {
    if (!data || !confirm(`${data.eventName}\n対象 ${data.submissionSummary.total}名・成立 ${candidateSummary.approved}組として、結果を確定・公開しますか？`)) return;
    await run(async () => {
      const response = await fetch(`/api/admin/events/${eventId}/results/confirm`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.code);
      setMessage("結果を確定・公開しました。");
      setPreview(null);
      await load();
    });
  }

  async function showPreview() {
    await run(async () => {
      const response = await fetch(`/api/admin/events/${eventId}/notifications/preview`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.code);
      setPreview(body.data);
      setMessage("通知対象と文面を読み込みました。");
    });
  }

  async function send() {
    if (!data || !preview || !confirm(`${data.eventName}\n通知対象 ${preview.targetCount}名・成立 ${preview.approvedCount}組の通知を予約しますか？`)) return;
    await run(async () => {
      const response = await fetch(`/api/admin/events/${eventId}/notifications/send-results`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedTargetCount: preview.targetCount, expectedApprovedCount: preview.approvedCount }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.code);
      setMessage(`${body.data.queuedCount}件の通知を予約しました。`);
    });
  }

  async function revoke() {
    const reason = prompt("確定取消の理由を入力してください");
    if (!reason) return;
    await run(async () => {
      const response = await fetch(`/api/admin/events/${eventId}/results/revoke`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.code);
      setMessage("結果確定を取り消しました。");
      setPreview(null);
      await load();
    });
  }

  if (!data && !error) return <p role="status">結果候補を読み込んでいます…</p>;

  return <div className="stack results-console">
    {data && <>
      <section className="current-operation-event"><span>操作中のイベント</span><strong>{data.eventName}</strong></section>
      <section className="result-overview" aria-label="結果処理の概要">
        <div><span>現在の状態</span><strong>{getEventStatusLabel(data.eventStatus)}</strong></div>
        <div><span>希望提出</span><strong>{data.submissionSummary.submitted}<small> / {data.submissionSummary.total}名</small></strong></div>
        <div><span>成立承認</span><strong>{candidateSummary.approved}<small>組</small></strong></div>
        <div><span>未判定</span><strong>{candidateSummary.pending}<small>組</small></strong></div>
      </section>

      <div className="actions result-phase-actions">
        {canDecide && data.eventStatus === "in_progress" && <button disabled={busy} onClick={() => transition("preference_open")}>希望入力を開始</button>}
        {canDecide && data.eventStatus === "preference_open" && <button disabled={busy} onClick={() => transition("preference_closed")}>希望入力を締切</button>}
      </div>

      <section>
        <div className="result-section-heading"><div><p className="eyebrow">MATCH CANDIDATES</p><h2>双方希望候補</h2></div><span>{candidateSummary.total}組</span></div>
        <div className="result-filter-controls"><label>参加者を検索<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="A、A01、氏名の一部" inputMode="search" /></label><label>判定状態<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ResultStatusFilter)}><option value="all">すべて</option><option value="pending">未判定・保留</option><option value="approved">承認</option><option value="declined">非承認</option></select></label></div>
        <p className="result-visible-count">{visibleCandidates.length}組表示 / 全{candidateSummary.total}組</p>
        {data.candidates.length === 0 ? <p className="participant-empty">現在、双方希望候補はありません。</p> : visibleCandidates.length === 0 ? <p className="participant-empty">条件に合う候補はありません。検索文字または状態を変更してください。</p> : <div className="result-candidate-list">
          {visibleCandidates.map((candidate) => {
            const personA = people.get(candidate.participantAId);
            const personB = people.get(candidate.participantBId);
            return <article className="result-candidate-card" key={candidate.id}>
              <div className="result-candidate-heading"><strong>{personA?.participantNumber ?? "未採番"} × {personB?.participantNumber ?? "未採番"}</strong><span className={`result-status ${resultStatusClass(candidate.status)}`}>{getMatchCandidateStatusLabel(candidate.status)}</span></div>
              <div className="result-person-pair"><div><small>{personA?.participantNumber ?? "未採番"}</small><strong>{personA?.fullName ?? "参加者情報なし"}</strong></div><span aria-hidden="true">×</span><div><small>{personB?.participantNumber ?? "未採番"}</small><strong>{personB?.fullName ?? "参加者情報なし"}</strong></div></div>
              <p className="result-rank">{data.preferenceMode === "ranked_up_to_3" ? `双方順位：${candidate.aRank ?? "—"}位 / ${candidate.bRank ?? "—"}位` : "順位なし方式"}</p>
              {canDecide && data.eventStatus === "preference_closed" && <div className="result-decision-actions" aria-label="候補の判定"><button disabled={busy} onClick={() => decide(candidate.id, "approved")}>承認</button><button className="secondary" disabled={busy} onClick={() => decide(candidate.id, "pending")}>保留</button><button className="secondary" disabled={busy} onClick={() => decide(candidate.id, "declined")}>非承認</button></div>}
            </article>;
          })}
        </div>}
      </section>

      {data.conflicts.length > 0 && <div className="result-warning" role="alert"><strong>競合があります</strong><p>複数成立を許可しない設定に対し、{data.conflicts.length}件の競合があります。公開前に判定を見直してください。</p></div>}

      {canDecide && data.eventStatus === "preference_closed" && <section className="result-primary-action"><div><strong>結果を確定・公開</strong><span>対象 {data.submissionSummary.total}名 / 成立 {candidateSummary.approved}組</span></div><button disabled={busy || data.conflicts.length > 0} onClick={confirmResults}>{busy ? "処理中…" : "人数を確認して公開"}</button></section>}

      {canDecide && data.eventStatus === "result_confirmed" && <section className="result-notification-panel"><p className="eyebrow">RESULT NOTIFICATION</p><h2>結果通知</h2><p>必ず対象数と文面を確認してから通知を予約します。</p><button className="secondary" disabled={busy} onClick={showPreview}>通知対象と文面をプレビュー</button>{preview && <div className="notification-preview"><div className="result-overview"><div><span>通知対象</span><strong>{preview.targetCount}<small>名</small></strong></div><div><span>成立</span><strong>{preview.approvedCount}<small>組</small></strong></div><div><span>成立参加者</span><strong>{preview.matchedParticipantCount}<small>名</small></strong></div><div><span>不成立</span><strong>{preview.unmatchedParticipantCount}<small>名</small></strong></div></div><details><summary>成立通知の文面</summary><p>{preview.matchedText}</p></details><details><summary>不成立通知の文面</summary><p>{preview.unmatchedText}</p></details><button disabled={busy} onClick={send}>{busy ? "処理中…" : `${preview.targetCount}名への通知を予約`}</button></div>}</section>}

      {canRevoke && data.eventStatus === "result_confirmed" && <button className="secondary" disabled={busy} onClick={revoke}>確定を取り消す</button>}
    </>}
    {message && <div className="operation-feedback" role="status"><p>{message}</p></div>}
    {error && <div className="operation-feedback operation-feedback-error" role="alert"><p>{error}</p><button className="secondary" disabled={busy} onClick={() => run(load)}>状態を再読み込み</button></div>}
  </div>;
}
