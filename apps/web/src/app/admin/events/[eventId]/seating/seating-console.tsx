"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildSeatingMap,
  countChangedAssignments,
  filterSeatingAssignments,
  type SeatingAssignmentFilter,
} from "../../../../../lib/seating-filter";
import { moveParticipantToSeat } from "../../../../../lib/seating-move";

type Assignment = { participantId: string; seatId: string | null; locked: boolean };
type Run = {
  id: string;
  status: string;
  scoreSummary: { warnings?: string[]; unassignedParticipantIds?: string[] };
  assignments: Assignment[];
};
type Participant = {
  id: string;
  participantNumber: string | null;
  fullName: string;
  category: string;
  checkinStatus: string | null;
};
type Seat = { id: string; tableCode: string; seatCode: string; enabled: boolean };
type Payload = { runs: Run[]; participants: Participant[]; seats: Seat[] };

export function SeatingConsole({
  eventId,
  eventName,
  canPublish,
}: {
  eventId: string;
  eventName: string;
  canPublish: boolean;
}) {
  const [data, setData] = useState<Payload>({ runs: [], participants: [], seats: [] });
  const [edits, setEdits] = useState<Record<string, Assignment[]>>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SeatingAssignmentFilter>("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [selectedForMove, setSelectedForMove] = useState<Record<string, string | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    setRequiresLogin(false);
    try {
      const response = await fetch(`/api/admin/events/${eventId}/seating-runs`);
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data) {
        setError(true);
        setRequiresLogin(response.status === 401);
        setMessage(
          response.status === 401
            ? "ログインの有効期限が切れました。再ログインしてください。"
            : "配置案を読み込めませんでした。通信状態を確認してください。",
        );
        return;
      }
      setData(body.data);
      setEdits(Object.fromEntries(body.data.runs.map((run: Run) => [run.id, run.assignments])));
    } catch {
      setError(true);
      setMessage("配置案を読み込めませんでした。通信状態を確認してください。");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/events/${eventId}/seating-runs`)
      .then(async (response) => ({ response, body: await response.json().catch(() => null) }))
      .then(({ response, body }) => {
        if (!active) return;
        if (!response.ok || !body?.data) {
          setError(true);
          setRequiresLogin(response.status === 401);
          setMessage(
            response.status === 401
              ? "ログインの有効期限が切れました。再ログインしてください。"
              : "配置案を読み込めませんでした。通信状態を確認してください。",
          );
          return;
        }
        setData(body.data);
        setEdits(Object.fromEntries(body.data.runs.map((run: Run) => [run.id, run.assignments])));
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setMessage("配置案を読み込めませんでした。通信状態を確認してください。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventId]);

  async function create() {
    const checkedInCount = data.participants.filter((participant) => participant.checkinStatus === "checked_in").length;
    if (!window.confirm(`${eventName}の受付済み${checkedInCount}名を対象に、新しい配置案を作成しますか？`)) return;
    setBusy("create");
    setError(false);
    setMessage("配置案を計算中です…");
    try {
      const response = await fetch(`/api/admin/events/${eventId}/seating-runs`, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data) {
        setError(true);
        setMessage(`配置案を作成できませんでした${body?.code ? `（${body.code}）` : ""}。`);
        return;
      }
      setMessage(`配置案を作成しました。未配置は${body.data.unassignedParticipantIds.length}名です。`);
      await load();
    } catch {
      setError(true);
      setMessage("配置案を作成できませんでした。通信状態を確認してください。");
    } finally {
      setBusy("");
    }
  }

  function edit(runId: string, participantId: string, update: Partial<Assignment>) {
    setEdits((current) => ({
      ...current,
      [runId]: (current[runId] ?? []).map((assignment) =>
        assignment.participantId === participantId ? { ...assignment, ...update } : assignment,
      ),
    }));
  }

  async function save(run: Run) {
    const assignments = edits[run.id] ?? [];
    const changedCount = countChangedAssignments(run.assignments, assignments);
    if (!changedCount) {
      setError(false);
      setMessage("保存する変更はありません。");
      return;
    }
    setBusy(`save:${run.id}`);
    setError(false);
    setMessage(`${changedCount}名分の変更を保存しています…`);
    try {
      const response = await fetch(`/api/admin/events/${eventId}/seating-runs/${run.id}/assignments`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignments }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(true);
        setMessage(`席変更を保存できませんでした${body?.code ? `（${body.code}）` : ""}。`);
        return;
      }
      setMessage(`${changedCount}名分の席変更とロックを保存しました。`);
      await load();
    } catch {
      setError(true);
      setMessage("席変更を保存できませんでした。通信状態を確認してください。");
    } finally {
      setBusy("");
    }
  }

  async function publish(run: Run) {
    const assignments = edits[run.id] ?? run.assignments;
    const assignedCount = assignments.filter((assignment) => assignment.seatId).length;
    const unassignedCount = assignments.length - assignedCount;
    if (
      !window.confirm(
        `${eventName}の席配置を公開します。配置済み${assignedCount}名、未配置${unassignedCount}名です。参加者へ公開してよいですか？`,
      )
    )
      return;
    setBusy(`publish:${run.id}`);
    setError(false);
    setMessage("席配置を公開しています…");
    try {
      const response = await fetch(`/api/admin/events/${eventId}/seating-runs/${run.id}/publish`, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(true);
        setMessage(`席配置を公開できませんでした${body?.code ? `（${body.code}）` : ""}。`);
        return;
      }
      setMessage("席配置を公開しました。");
      await load();
    } catch {
      setError(true);
      setMessage("席配置を公開できませんでした。通信状態を確認してください。");
    } finally {
      setBusy("");
    }
  }

  const participantById = useMemo(
    () => new Map(data.participants.map((participant) => [participant.id, participant])),
    [data.participants],
  );
  const seatById = useMemo(() => new Map(data.seats.map((seat) => [seat.id, seat])), [data.seats]);
  const enabledSeats = data.seats.filter((seat) => seat.enabled);
  const checkedInCount = data.participants.filter((participant) => participant.checkinStatus === "checked_in").length;

  function selectParticipantForMove(runId: string, participantId: string) {
    const assignment = (edits[runId] ?? []).find((item) => item.participantId === participantId);
    if (assignment?.locked) {
      setError(true);
      setMessage("ロック中の参加者は移動できません。先にロックを解除してください。");
      return;
    }
    setError(false);
    setSelectedForMove((current) => ({ ...current, [runId]: current[runId] === participantId ? null : participantId }));
    const participant = participantById.get(participantId);
    setMessage(`${participant?.participantNumber ?? "未採番"}を選択しました。座席図で移動先をタップしてください。`);
  }

  function moveSelectedParticipant(runId: string, targetSeatId: string | null) {
    const participantId = selectedForMove[runId];
    if (!participantId) {
      setError(false);
      setMessage("先に移動する参加者を選んでください。");
      return;
    }
    const current = edits[runId] ?? [];
    const result = moveParticipantToSeat(current, participantId, targetSeatId);
    if (!result.ok) {
      setError(result.code !== "NO_CHANGE");
      setMessage(
        result.code === "TARGET_LOCKED"
          ? "移動先はロックされています。別の席を選んでください。"
          : result.code === "SOURCE_LOCKED"
            ? "選択した参加者はロックされています。"
            : result.code === "NO_CHANGE"
              ? "現在と同じ席です。"
              : "参加者を確認できませんでした。",
      );
      return;
    }
    setEdits((currentEdits) => ({ ...currentEdits, [runId]: result.assignments }));
    setSelectedForMove((currentSelected) => ({ ...currentSelected, [runId]: null }));
    const participant = participantById.get(participantId);
    const targetSeat = targetSeatId ? seatById.get(targetSeatId) : null;
    setError(false);
    setMessage(
      `${participant?.participantNumber ?? "未採番"}を${targetSeat ? `${targetSeat.tableCode} / ${targetSeat.seatCode}` : "未配置"}へ移動しました${result.swappedParticipantId ? "（移動先の参加者とは席を交換）" : ""}。まだ未保存です。`,
    );
  }

  return (
    <div className="stack seating-console">
      <p className="current-operation-event">
        <span>席配置対象イベント</span>
        <strong>{eventName}</strong>
      </p>
      <div className="summary seating-overview" aria-label="席配置状況">
        <span>受付済み {checkedInCount}名</span>
        <span>有効席 {enabledSeats.length}席</span>
        <span>配置案 {data.runs.length}件</span>
      </div>
      <div className="actions">
        <button type="button" disabled={loading || Boolean(busy)} onClick={create}>
          {busy === "create" ? "計算中…" : "新しい配置案を生成"}
        </button>
        <a className="button-link secondary" href={`/admin/events/${eventId}/questionnaire`}>
          5問設定を確認
        </a>
      </div>
      {message && (
        <div
          className={`operation-feedback${error ? " operation-feedback-error" : ""}`}
          role={error ? "alert" : "status"}
          aria-live="polite"
        >
          <p>{message}</p>
          {requiresLogin && (
            <a className="button-link" href="/admin/login">
              再ログインする
            </a>
          )}
        </div>
      )}
      {loading && (
        <p className="participant-empty" role="status">
          配置案を読み込んでいます…
        </p>
      )}
      {!loading && data.runs.length === 0 && (
        <p className="participant-empty">配置案はまだありません。「新しい配置案を生成」から開始してください。</p>
      )}

      {!loading && data.runs.some((run) => run.status === "draft") && (
        <div className="settings-grid seating-filter-controls">
          <label>
            参加者検索
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例: A / A01 / 氏名の一部"
              inputMode="search"
            />
          </label>
          <label>
            表示対象
            <select value={filter} onChange={(event) => setFilter(event.target.value as SeatingAssignmentFilter)}>
              <option value="all">すべて</option>
              <option value="assigned">配置済み</option>
              <option value="unassigned">未配置</option>
              <option value="locked">ロック中</option>
            </select>
          </label>
        </div>
      )}

      {data.runs.map((run, runIndex) => {
        const currentAssignments = edits[run.id] ?? run.assignments;
        const visibleAssignments = filterSeatingAssignments(currentAssignments, data.participants, query, filter);
        const assignedCount = currentAssignments.filter((assignment) => assignment.seatId).length;
        const changedCount = countChangedAssignments(run.assignments, currentAssignments);
        const usedSeatByParticipant = new Map(
          currentAssignments
            .filter((assignment) => assignment.seatId)
            .map((assignment) => [assignment.seatId!, assignment.participantId]),
        );
        const tableMap = buildSeatingMap(enabledSeats, currentAssignments, data.participants);
        const selectedParticipantId = selectedForMove[run.id] ?? null;
        const selectedParticipant = selectedParticipantId ? participantById.get(selectedParticipantId) : null;
        const runLabel =
          run.status === "published"
            ? "公開済み"
            : run.status === "draft"
              ? runIndex === 0
                ? "最新の下書き"
                : "以前の下書き"
              : "旧版";
        return (
          <details className="seating-run" key={run.id} open={runIndex === 0}>
            <summary>
              <span>{runLabel}</span>
              <small>
                配置 {assignedCount}名 / 未配置 {currentAssignments.length - assignedCount}名
              </small>
            </summary>
            <div className="seating-run-body">
              {run.scoreSummary.warnings?.length ? (
                <div className="configuration-incomplete">
                  <h3>確認事項</h3>
                  <ul>
                    {run.scoreSummary.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <section className="seating-map" aria-label="テーブル別座席図">
                <div className="seating-map-heading">
                  <div>
                    <h3>テーブル別の座席図</h3>
                    <p className="hint">席変更とロック状態は、この図へすぐ反映されます。</p>
                  </div>
                  <div className="seating-map-legend" aria-label="座席図の凡例">
                    <span>
                      <i className="seating-legend-occupied" />
                      配置済み
                    </span>
                    <span>
                      <i className="seating-legend-locked" />
                      固定
                    </span>
                    <span>
                      <i className="seating-legend-empty" />
                      空席
                    </span>
                  </div>
                </div>
                {run.status === "draft" && (
                  <div className={`seating-move-guide${selectedParticipantId ? " is-active" : ""}`} role="status">
                    <div>
                      <strong>
                        {selectedParticipantId
                          ? `${selectedParticipant?.participantNumber ?? "未採番"}を移動`
                          : "タップで席を移動"}
                      </strong>
                      <span>
                        {selectedParticipantId
                          ? "移動先の席をタップしてください。使用中の席なら2名を交換します。"
                          : "座席図の参加者、または下の「図で席を移動」をタップしてください。"}
                      </span>
                    </div>
                    {selectedParticipantId && (
                      <div className="seating-move-actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => moveSelectedParticipant(run.id, null)}
                        >
                          未配置にする
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setSelectedForMove((current) => ({ ...current, [run.id]: null }))}
                        >
                          選択を解除
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="seating-table-grid">
                  {tableMap.map((table) => (
                    <article className="seating-table-map" key={table.tableCode}>
                      <div className="seating-table-label">
                        <small>TABLE</small>
                        <strong>{table.tableCode}</strong>
                      </div>
                      <div className="seating-seat-grid">
                        {table.seats.map((seat) => (
                          <button
                            type="button"
                            disabled={
                              run.status !== "draft" ||
                              Boolean(busy) ||
                              seat.locked ||
                              (!selectedParticipantId && !seat.participantId)
                            }
                            aria-label={
                              seat.participantId
                                ? `${table.tableCode} ${seat.seatCode} ${seat.participantNumber ?? "未採番"}`
                                : `${table.tableCode} ${seat.seatCode} 空席`
                            }
                            onClick={() =>
                              selectedParticipantId
                                ? moveSelectedParticipant(run.id, seat.id)
                                : seat.participantId
                                  ? selectParticipantForMove(run.id, seat.participantId)
                                  : undefined
                            }
                            className={`seating-map-seat${seat.participantId ? " seating-map-seat-occupied" : " seating-map-seat-empty"}${seat.locked ? " seating-map-seat-locked" : ""}${seat.participantId === selectedParticipantId ? " seating-map-seat-selected" : ""}`}
                            key={seat.id}
                          >
                            <span className="seating-map-seat-code">{seat.seatCode}</span>
                            {seat.participantId ? (
                              <>
                                <strong>{seat.participantNumber ?? "未採番"}</strong>
                                <span>{seat.fullName ?? "参加者情報なし"}</span>
                                {seat.locked && <em>固定</em>}
                              </>
                            ) : (
                              <strong className="seating-empty-label">空席</strong>
                            )}
                          </button>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
                {currentAssignments.length - assignedCount > 0 && (
                  <p className="seating-unassigned-notice">
                    未配置の参加者が {currentAssignments.length - assignedCount}名います。
                  </p>
                )}
              </section>
              {run.status === "draft" && (
                <>
                  <p className="hint" role="status">
                    {visibleAssignments.length}件表示 / 全{currentAssignments.length}件
                    {changedCount ? `・未保存 ${changedCount}件` : ""}
                  </p>
                  {visibleAssignments.length === 0 ? (
                    <p className="participant-empty">条件に合う参加者がいません。</p>
                  ) : (
                    <div className="admin-card-list seating-card-list">
                      {visibleAssignments.map((assignment) => {
                        const person = participantById.get(assignment.participantId);
                        const currentSeat = assignment.seatId ? seatById.get(assignment.seatId) : null;
                        return (
                          <article className="admin-list-card seating-assignment-card" key={assignment.participantId}>
                            <div>
                              <strong>{person?.participantNumber ?? "未採番"}</strong>
                              <span>{person?.fullName ?? "参加者情報なし"}</span>
                              <small>{person?.category}</small>
                            </div>
                            <dl>
                              <dt>受付</dt>
                              <dd>{person?.checkinStatus === "checked_in" ? "受付済み" : "未受付"}</dd>
                              <dt>現在の席</dt>
                              <dd>{currentSeat ? `${currentSeat.tableCode} / ${currentSeat.seatCode}` : "未配置"}</dd>
                            </dl>
                            <div className="seating-card-controls">
                              <button
                                type="button"
                                className={selectedParticipantId === assignment.participantId ? "" : "secondary"}
                                disabled={assignment.locked || Boolean(busy)}
                                onClick={() => selectParticipantForMove(run.id, assignment.participantId)}
                              >
                                {selectedParticipantId === assignment.participantId
                                  ? "移動先の席を選択中"
                                  : "図で席を移動"}
                              </button>
                              <label>
                                席
                                <select
                                  value={assignment.seatId ?? ""}
                                  disabled={assignment.locked || Boolean(busy)}
                                  onChange={(event) =>
                                    edit(run.id, assignment.participantId, { seatId: event.target.value || null })
                                  }
                                >
                                  <option value="">未配置</option>
                                  {enabledSeats.map((seat) => {
                                    const usedBy = usedSeatByParticipant.get(seat.id);
                                    const occupied = Boolean(usedBy && usedBy !== assignment.participantId);
                                    return (
                                      <option key={seat.id} value={seat.id} disabled={occupied}>
                                        {seat.tableCode} / {seat.seatCode}
                                        {occupied ? "（使用中）" : ""}
                                      </option>
                                    );
                                  })}
                                </select>
                              </label>
                              <label className="seating-lock-control">
                                <input
                                  type="checkbox"
                                  checked={assignment.locked}
                                  disabled={Boolean(busy)}
                                  onChange={(event) =>
                                    edit(run.id, assignment.participantId, { locked: event.target.checked })
                                  }
                                />
                                <span>この席をロック</span>
                              </label>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                  <div className="actions seating-run-actions">
                    <button
                      type="button"
                      className="secondary"
                      disabled={Boolean(busy) || changedCount === 0}
                      onClick={() => save(run)}
                    >
                      {busy === `save:${run.id}`
                        ? "保存中…"
                        : `変更を保存${changedCount ? `（${changedCount}件）` : ""}`}
                    </button>
                    {canPublish && (
                      <button type="button" disabled={Boolean(busy) || changedCount > 0} onClick={() => publish(run)}>
                        {busy === `publish:${run.id}` ? "公開中…" : "内容を確認して公開"}
                      </button>
                    )}
                  </div>
                  {changedCount > 0 && canPublish && <p className="hint">公開する前に変更を保存してください。</p>}
                </>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
