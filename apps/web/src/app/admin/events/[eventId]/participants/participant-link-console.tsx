"use client";

import { useState } from "react";
import { buildLiffApplicationLink } from "@shime/core/line/public-url";
import { useParticipantNumberAdmin } from "../../../../../hooks/use-participant-number-admin";
import { filterParticipantLinkRows, type ParticipantLinkFilter } from "../../../../../lib/participant-link-filter";

type ParticipantRow = {
  id: string;
  participantNumber: string | null;
  participantCategory: string;
  fullName: string;
  linked: boolean;
  linkTokenExpiresAt: string | null;
  linkTokenUsed: boolean;
};

type IssuedLink = { participantId: string; url: string; expiresAt: string };

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

function linkStatus(participant: ParticipantRow): string {
  if (participant.linked) return "利用済み";
  if (participant.linkTokenExpiresAt && !participant.linkTokenUsed) {
    return `${new Date(participant.linkTokenExpiresAt).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      dateStyle: "short",
      timeStyle: "short",
    })}まで`;
  }
  return "無効";
}

export function ParticipantLinkConsole({
  eventId,
  eventName,
  liffId,
  manualNumbering,
  numberDigits,
  groupAPrefix,
  groupBPrefix,
  initial,
}: {
  eventId: string;
  eventName: string;
  liffId: string;
  manualNumbering: boolean;
  numberDigits: number;
  groupAPrefix: string;
  groupBPrefix: string;
  initial: ParticipantRow[];
}) {
  const [participants, setParticipants] = useState(initial);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ParticipantLinkFilter>("all");
  const [issued, setIssued] = useState<IssuedLink | null>(null);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [numberDrafts, setNumberDrafts] = useState<Record<string, string>>({});
  const participantNumberAdmin = useParticipantNumberAdmin(eventId);
  const filtered = filterParticipantLinkRows(participants, query, filter);

  async function assignNumber(participant: ParticipantRow) {
    const prefix = participant.participantCategory === "group_a" ? groupAPrefix : groupBPrefix;
    const suggested = `${prefix}${String(1).padStart(numberDigits, "0")}`;
    const value = (numberDrafts[participant.id] ?? "").trim();
    if (!value) {
      setMessage(`参加者番号を入力してください（例: ${suggested}）。`);
      return;
    }
    const operation = participant.participantNumber ? "変更" : "付与";
    if (!confirm(`${participant.fullName}さんの参加者番号を「${value}」へ${operation}します。`)) return;
    const assignment = await participantNumberAdmin.assign(participant.id, value);
    if (!assignment.data) {
      const feedback: Record<string, string> = {
        PARTICIPANT_NUMBER_DUPLICATE: "その番号はすでに使用されています。",
        INVALID_PARTICIPANT_NUMBER: `区分に合う番号を入力してください（例: ${suggested}）。`,
        MANUAL_NUMBERING_DISABLED: "基本設定で参加者番号を「手動付与」に変更してください。",
      };
      setMessage(feedback[assignment.code ?? ""] ?? "参加者番号を保存できませんでした。");
      return;
    }
    const saved = assignment.data;
    setParticipants((current) =>
      current.map((item) =>
        item.id === participant.id ? { ...item, participantNumber: saved.participantNumber } : item,
      ),
    );
    setNumberDrafts((current) => ({ ...current, [participant.id]: "" }));
    setMessage(`${saved.participantNumber}へ${operation}しました。参加者はSHIME PASSを発行できます。`);
  }

  async function reissue(participant: ParticipantRow) {
    if (
      !confirm(
        `${participant.participantNumber ?? "未採番"} ${participant.fullName}さんの本人連携リンクを再発行します。旧URLは使えなくなります。`,
      )
    )
      return;
    setBusyId(participant.id);
    setMessage("");
    setIssued(null);
    const response = await fetch(`/api/admin/events/${eventId}/participants/${participant.id}/link-token`, {
      method: "POST",
    });
    const body = await response.json();
    setBusyId("");
    if (!response.ok) {
      setMessage(body.code === "ALREADY_LINKED" ? "すでにLINE本人連携済みです。" : `再発行できません: ${body.code}`);
      return;
    }
    const url = buildLiffApplicationLink(liffId, eventId, body.data.linkToken);
    if (!url) {
      setMessage("LIFF IDが設定されていません。外部接続設定を確認してください。");
      return;
    }
    setParticipants((current) =>
      current.map((item) =>
        item.id === participant.id ? { ...item, linkTokenExpiresAt: body.data.expiresAt, linkTokenUsed: false } : item,
      ),
    );
    setIssued({ participantId: participant.id, url, expiresAt: body.data.expiresAt });
    setMessage("新しい本人連携リンクを発行しました。この画面を閉じる前に利用またはコピーしてください。");
  }

  return (
    <div className="admin-stack">
      <section className="panel wide">
        <p className="eyebrow">PARTICIPANT LINE LINK</p>
        <h1>{eventName} 本人連携</h1>
        <p>番号の先頭または氏名の一部で検索できます。未連携参加者だけに絞り込むと、発行対象をすぐ選べます。</p>
        {manualNumbering && (
          <section className="configuration-complete">
            <h2>参加者番号を手動付与</h2>
            <p>区分に合う参加者番号を付与・変更できます。重複番号や区分と異なる番号は保存できません。</p>
          </section>
        )}

        <div className="settings-grid participant-filter-controls">
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
            連携状態
            <select value={filter} onChange={(event) => setFilter(event.target.value as ParticipantLinkFilter)}>
              <option value="all">すべて</option>
              <option value="unlinked">未連携のみ</option>
              <option value="linked">連携済みのみ</option>
            </select>
          </label>
        </div>
        <p className="hint" role="status">
          {filtered.length}件 / 全{participants.length}件
        </p>

        {message && <p role="status">{message}</p>}
        {issued && (
          <section className="configuration-complete">
            <h2>再発行済み</h2>
            <p>
              有効期限:{" "}
              {new Date(issued.expiresAt).toLocaleString("ja-JP", {
                timeZone: "Asia/Tokyo",
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
            <div className="actions">
              <a className="button-link" href={issued.url}>
                LINEで本人連携を開く
              </a>
              <button
                type="button"
                className="secondary"
                onClick={async () =>
                  setMessage((await copyText(issued.url)) ? "本人連携リンクをコピーしました。" : "コピーできません。")
                }
              >
                リンクをコピー
              </button>
            </div>
            <p className="hint">本人以外へは送信しないでください。</p>
          </section>
        )}

        {filtered.length === 0 ? (
          <p className="participant-empty">条件に合う参加者がいません。</p>
        ) : (
          <div className="admin-card-list">
            {filtered.map((participant) => (
              <article className="admin-list-card" key={participant.id}>
                <div>
                  <strong>{participant.participantNumber ?? "未採番"}</strong>
                  <span>{participant.fullName}</span>
                </div>
                <dl>
                  <dt>LINE連携</dt>
                  <dd>{participant.linked ? "連携済み" : "未連携"}</dd>
                  <dt>現在のリンク</dt>
                  <dd>{linkStatus(participant)}</dd>
                </dl>
                {manualNumbering && (
                  <div className="settings-grid">
                    <label>
                      参加者番号
                      <input
                        value={numberDrafts[participant.id] ?? participant.participantNumber ?? ""}
                        onChange={(event) =>
                          setNumberDrafts((current) => ({ ...current, [participant.id]: event.target.value }))
                        }
                        placeholder={`${participant.participantCategory === "group_a" ? groupAPrefix : groupBPrefix}${String(1).padStart(numberDigits, "0")}`}
                        autoCapitalize="characters"
                        inputMode="text"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={participantNumberAdmin.busyId === participant.id}
                      onClick={() => assignNumber(participant)}
                    >
                      {participantNumberAdmin.busyId === participant.id
                        ? "保存中…"
                        : participant.participantNumber
                          ? "番号を変更"
                          : "番号を付与"}
                    </button>
                  </div>
                )}
                {participant.linked ? (
                  <p className="hint">本人連携済みです。</p>
                ) : (
                  <button type="button" disabled={busyId === participant.id} onClick={() => reissue(participant)}>
                    {busyId === participant.id ? "再発行中…" : "リンクを再発行"}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}

        <div className="actions">
          <a className="button-link secondary" href="/admin">
            管理トップへ
          </a>
        </div>
      </section>
    </div>
  );
}
