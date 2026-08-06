"use client";

import { useState } from "react";
import type { CreateInteractionMemoDraftInput, InteractionPublicProfileFieldKey } from "@shime/interactions";
import { useInteractionMemoAdmin } from "@shime/web/hooks/use-interaction-memo-admin";

const INITIAL_OPTIONS = [
  { code: "reassured", label: "安心した", enabled: true, isNegative: false },
  { code: "enjoyed", label: "楽しかった", enabled: true, isNegative: false },
  { code: "empathized", label: "共感した", enabled: true, isNegative: false },
  { code: "talk_again", label: "もう一度話したい", enabled: true, isNegative: false },
  { code: "support", label: "応援したい", enabled: true, isNegative: false },
  { code: "no_connection", label: "ご縁なし", enabled: true, isNegative: true },
] satisfies CreateInteractionMemoDraftInput["options"];

const PROFILE_FIELDS: Array<{ key: InteractionPublicProfileFieldKey; label: string }> = [
  { key: "nickname", label: "ニックネーム" },
  { key: "age_or_band", label: "年代" },
  { key: "residence_municipality", label: "市区町村" },
  { key: "occupation", label: "職業" },
  { key: "hobbies", label: "趣味" },
  { key: "holiday_style", label: "休日の過ごし方" },
  { key: "support_wanted", label: "応援してほしいこと" },
  { key: "support_offered", label: "応援できること" },
  { key: "public_dream", label: "公開Dream" },
];

const STATUS_LABELS = { draft: "下書き", published: "公開中", stopped: "停止済み" } as const;

export function InteractionMemoSettings({
  eventId,
  eventName,
  canPublish,
}: {
  eventId: string;
  eventName: string;
  canPublish: boolean;
}) {
  const admin = useInteractionMemoAdmin(eventId);
  const [targetSource, setTargetSource] = useState<CreateInteractionMemoDraftInput["targetSource"]>("self_reported");
  const [editableUntil, setEditableUntil] = useState("");
  const [profileFields, setProfileFields] = useState<InteractionPublicProfileFieldKey[]>([]);
  const [options, setOptions] = useState<CreateInteractionMemoDraftInput["options"]>(INITIAL_OPTIONS);
  const [message, setMessage] = useState<string | null>(null);

  async function createDraft() {
    setMessage(null);
    const saved = await admin.createDraft({
      targetSource,
      editableUntil: editableUntil ? new Date(editableUntil).toISOString() : null,
      publicProfileFieldKeys: profileFields,
      options,
    });
    if (saved) setMessage("新しい下書きを作成しました。公開するまで参加者画面は変わりません。");
  }

  return (
    <div className="interaction-memo-admin admin-stack">
      <section className="panel settings-panel">
        <p className="eyebrow">INTERACTION MEMO SETTINGS</p>
        <h1>会話メモ設定・版管理</h1>
        <p className="current-operation-event">
          <span>対象イベント</span>
          <strong>{eventName}</strong>
        </p>
        <p>設定変更は必ず新しい下書きとして保存されます。公開中の版と過去の記録は上書きしません。</p>
        {admin.error && (
          <p className="operation-feedback-error" role="alert">
            操作を完了できませんでした（{admin.error}）。
          </p>
        )}
        {message && (
          <p className="operation-feedback" role="status">
            {message}
          </p>
        )}
      </section>

      <section className="panel settings-panel">
        <h2>新しい下書きを作成</h2>
        <label>
          会話相手の登録方式
          <select value={targetSource} onChange={(event) => setTargetSource(event.target.value as typeof targetSource)}>
            <option value="self_reported">参加者番号で本人が選択（立食向け）</option>
            <option value="interaction_slot">運営が用意した会話枠・席配置を使用</option>
            <option value="operator_import">運営が取り込んだ会話枠を使用</option>
          </select>
        </label>
        <label>
          入力終了日時（未入力なら終了なし）
          <input
            type="datetime-local"
            value={editableUntil}
            onChange={(event) => setEditableUntil(event.target.value)}
          />
        </label>
        <fieldset>
          <legend>相手に表示してよいプロフィール項目</legend>
          <p>未選択なら参加者番号以外は公開しません。</p>
          <div className="interaction-memo-check-grid">
            {PROFILE_FIELDS.map((field) => (
              <label key={field.key}>
                <input
                  type="checkbox"
                  checked={profileFields.includes(field.key)}
                  onChange={(event) =>
                    setProfileFields((current) =>
                      event.target.checked ? [...current, field.key] : current.filter((key) => key !== field.key),
                    )
                  }
                />
                {field.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>会話メモの選択肢</legend>
          <div className="interaction-memo-options">
            {options.map((option, index) => (
              <div className="admin-list-card" key={`${option.code}-${index}`}>
                <label>
                  内部コード
                  <input
                    value={option.code}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, code: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  表示文
                  <input
                    value={option.label}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, label: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={option.enabled}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, enabled: event.target.checked } : item,
                        ),
                      )
                    }
                  />
                  使用する
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={option.isNegative}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, isNegative: event.target.checked } : item,
                        ),
                      )
                    }
                  />
                  否定的な選択肢として扱う
                </label>
                <button
                  type="button"
                  className="secondary"
                  disabled={options.length === 1}
                  onClick={() => setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="secondary"
            disabled={options.length >= 8}
            onClick={() =>
              setOptions((current) => [
                ...current,
                { code: `option_${current.length + 1}`, label: "新しい選択肢", enabled: true, isNegative: false },
              ])
            }
          >
            選択肢を追加
          </button>
        </fieldset>
        <button type="button" disabled={admin.busy} onClick={() => void createDraft()}>
          {admin.busy ? "保存中…" : "下書きを作成"}
        </button>
      </section>

      <section className="panel settings-panel">
        <h2>版の履歴</h2>
        {admin.loading ? (
          <p>読み込み中…</p>
        ) : admin.snapshots.length === 0 ? (
          <p>まだ会話メモ設定はありません。機能は参加者に表示されません。</p>
        ) : (
          <ol className="interaction-memo-history">
            {admin.snapshots.map((snapshot) => (
              <li className="admin-list-card" key={snapshot.id}>
                <div>
                  <strong>バージョン {snapshot.version}</strong>
                  <span className={`interaction-memo-status ${snapshot.status}`}>{STATUS_LABELS[snapshot.status]}</span>
                </div>
                <p>
                  {snapshot.options
                    .filter((option) => option.enabled)
                    .map((option) => option.label)
                    .join(" / ")}
                </p>
                <small>
                  登録方式: {snapshot.targetSource} ／ 作成: {new Date(snapshot.createdAt).toLocaleString("ja-JP")}
                </small>
                {canPublish && snapshot.status === "draft" && (
                  <button
                    type="button"
                    disabled={admin.busy}
                    onClick={() => {
                      if (window.confirm(`バージョン ${snapshot.version} を公開しますか？`)) {
                        void admin
                          .publish(snapshot.id)
                          .then((saved) => saved && setMessage("会話メモ設定を公開しました。"));
                      }
                    }}
                  >
                    この版を公開
                  </button>
                )}
                {canPublish && snapshot.status === "published" && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={admin.busy}
                    onClick={() => {
                      if (window.confirm("会話メモを停止しますか？参加者は新しく入力できなくなります。")) {
                        void admin
                          .stop(snapshot.id)
                          .then((saved) => saved && setMessage("会話メモを停止しました。過去記録は保持されます。"));
                      }
                    }}
                  >
                    公開を停止
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
        {!canPublish && <p className="participant-privacy">公開・停止は公開権限を持つ運営責任者が行います。</p>}
      </section>
    </div>
  );
}
