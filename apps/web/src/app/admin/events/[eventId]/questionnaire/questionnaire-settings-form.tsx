"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  AXIS_LABELS,
  questionnaireEditorIssues,
  type QuestionnaireKind,
  type QuestionnaireQuestionDraft,
} from "../../../../../lib/questionnaire-editor";

const defaults: QuestionnaireQuestionDraft[] = [
  {
    axis: "values",
    prompt: "大切にしたい価値観を選んでください",
    kind: "multi_select",
    maxSelections: 3,
    weight: 40,
    options: [
      { code: "family", label: "家族", scoreValue: null },
      { code: "work", label: "仕事", scoreValue: null },
      { code: "trust", label: "信頼", scoreValue: null },
      { code: "growth", label: "成長", scoreValue: null },
    ],
  },
  {
    axis: "marriage_intent",
    prompt: "結婚への今の温度感を教えてください",
    kind: "ordinal",
    maxSelections: 1,
    weight: 25,
    options: [
      { code: "1", label: "ゆっくり考えたい", scoreValue: 1 },
      { code: "2", label: "良い方がいれば", scoreValue: 2 },
      { code: "3", label: "前向き", scoreValue: 3 },
      { code: "4", label: "早めに考えたい", scoreValue: 4 },
      { code: "5", label: "具体的に考えている", scoreValue: 5 },
    ],
  },
  {
    axis: "relationship_pace",
    prompt: "関係を育てるペースを教えてください",
    kind: "ordinal",
    maxSelections: 1,
    weight: 15,
    options: [
      { code: "1", label: "ゆっくり", scoreValue: 1 },
      { code: "2", label: "少しずつ", scoreValue: 2 },
      { code: "3", label: "自然に", scoreValue: 3 },
      { code: "4", label: "積極的に", scoreValue: 4 },
      { code: "flexible", label: "相手に合わせたい", scoreValue: null },
    ],
  },
  {
    axis: "conversation_style",
    prompt: "会話で近いスタイルを選んでください",
    kind: "complement",
    maxSelections: 1,
    weight: 10,
    options: [
      { code: "talker", label: "話す方が得意", scoreValue: null },
      { code: "listener", label: "聞く方が得意", scoreValue: null },
      { code: "balance", label: "どちらも同じくらい", scoreValue: null },
    ],
  },
  {
    axis: "topic_overlap",
    prompt: "話してみたいテーマを選んでください",
    kind: "multi_select",
    maxSelections: 3,
    weight: 10,
    options: [
      { code: "food", label: "食", scoreValue: null },
      { code: "travel", label: "旅行", scoreValue: null },
      { code: "hobby", label: "趣味", scoreValue: null },
      { code: "work", label: "仕事", scoreValue: null },
      { code: "future", label: "将来", scoreValue: null },
    ],
  },
];

type Current = { code: string; name: string; version: number; questions: QuestionnaireQuestionDraft[] } | null;
type Template = {
  id: string;
  templateName: string;
  version: number;
  code: string;
  name: string;
  questions: QuestionnaireQuestionDraft[];
};

export function QuestionnaireSettingsForm({
  eventId,
  current,
  templates,
  canManageTemplates,
}: {
  eventId: string;
  current: Current;
  templates: Template[];
  canManageTemplates: boolean;
}) {
  const [questions, setQuestions] = useState<QuestionnaireQuestionDraft[]>(
    current?.questions.length === 5 ? current.questions : defaults,
  );
  const [code, setCode] = useState(current?.code ?? "seating-guide");
  const [name, setName] = useState(current?.name ?? "席案内5問");
  const [version, setVersion] = useState((current?.version ?? 0) + 1);
  const [sourceTemplateId, setSourceTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const issues = useMemo(() => questionnaireEditorIssues(questions), [questions]);
  const totalWeight = questions.reduce((sum, question) => sum + question.weight, 0);

  function updateQuestion(index: number, patch: Partial<QuestionnaireQuestionDraft>) {
    setQuestions((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }
  function updateOption(
    questionIndex: number,
    optionIndex: number,
    patch: Partial<QuestionnaireQuestionDraft["options"][number]>,
  ) {
    setQuestions((items) =>
      items.map((item, itemIndex) =>
        itemIndex !== questionIndex
          ? item
          : {
              ...item,
              options: item.options.map((option, index) => (index === optionIndex ? { ...option, ...patch } : option)),
            },
      ),
    );
  }
  function addOption(questionIndex: number) {
    setQuestions((items) =>
      items.map((item, index) =>
        index !== questionIndex
          ? item
          : {
              ...item,
              options: [...item.options, { code: `option_${item.options.length + 1}`, label: "", scoreValue: null }],
            },
      ),
    );
  }
  function removeOption(questionIndex: number, optionIndex: number) {
    setQuestions((items) =>
      items.map((item, index) =>
        index !== questionIndex
          ? item
          : { ...item, options: item.options.filter((_, target) => target !== optionIndex) },
      ),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (issues.length > 0 || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/events/${eventId}/questionnaire-settings`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, name, version, questions, ...(sourceTemplateId ? { sourceTemplateId } : {}) }),
      });
      const body = await response.json();
      setMessage(
        response.ok
          ? "新しい質問票バージョンを設定しました。"
          : `保存できません: ${body.code}${body.issues?.length ? ` / ${body.issues.join(" / ")}` : ""}`,
      );
    } catch {
      setMessage("通信に失敗しました。入力内容はこの画面に残っています。");
    } finally {
      setBusy(false);
    }
  }

  async function saveAsTemplate() {
    if (!templateName.trim() || issues.length || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/resource-templates/event-configurations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateType: "questionnaire",
          name: templateName.trim(),
          payload: { schemaVersion: 1, code, name, questions },
        }),
      });
      const body = await response.json();
      setMessage(
        response.ok
          ? `質問票テンプレート v${body.data.version} を保存しました。再読み込み後に選択できます。`
          : `テンプレートを保存できません: ${body.code}`,
      );
    } catch {
      setMessage("通信に失敗しました。入力内容はこの画面に残っています。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel wide questionnaire-editor">
      <p className="eyebrow">QUESTIONNAIRE</p>
      <h1>席案内5問の設定</h1>
      <p>コードを編集せず、1問ずつ質問文と選択肢を設定できます。保存時は新しい版として記録されます。</p>
      {current && (
        <p className="current-operation-event">
          <span>現在の版</span>
          <strong>
            {current.name} v{current.version}
          </strong>
        </p>
      )}
      <section className="resource-template-picker">
        <h2>テンプレートからコピー</h2>
        <p>コピー後はイベント専用の新しい質問票版として保存されます。</p>
        <label>
          質問票テンプレート
          <select
            value={sourceTemplateId}
            onChange={(event) => {
              const selected = templates.find((template) => template.id === event.target.value);
              setSourceTemplateId(event.target.value);
              if (selected) {
                setCode(selected.code);
                setName(selected.name);
                setQuestions(selected.questions);
              }
            }}
          >
            <option value="">現在のイベント設定を編集</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.templateName} (v{template.version})
              </option>
            ))}
          </select>
        </label>
        {canManageTemplates && (
          <div className="template-save-row">
            <label>
              現在の内容をテンプレート保存
              <input
                value={templateName}
                maxLength={160}
                placeholder="例：婚活イベント標準5問"
                onChange={(event) => setTemplateName(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="secondary"
              disabled={busy || !!issues.length || !templateName.trim()}
              onClick={saveAsTemplate}
            >
              テンプレートとして保存
            </button>
          </div>
        )}
      </section>
      <form className="stack" onSubmit={submit}>
        <section className="questionnaire-meta">
          <label>
            テンプレートコード
            <input
              name="code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              pattern="[a-z0-9_-]{2,80}"
              required
            />
          </label>
          <label>
            名称
            <input name="name" value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            新しいバージョン
            <input
              name="version"
              type="number"
              min="1"
              value={version}
              onChange={(event) => setVersion(Number(event.target.value))}
              required
            />
          </label>
        </section>
        <div className={`questionnaire-weight-summary ${totalWeight === 100 ? "is-complete" : ""}`}>
          <span>重み合計</span>
          <strong>{totalWeight} / 100</strong>
        </div>
        <div className="questionnaire-question-list">
          {questions.map((question, questionIndex) => (
            <fieldset className="questionnaire-question-card" key={question.axis}>
              <legend>
                {questionIndex + 1}. {AXIS_LABELS[question.axis]}
              </legend>
              <label>
                質問文
                <textarea
                  value={question.prompt}
                  rows={3}
                  maxLength={300}
                  onChange={(event) => updateQuestion(questionIndex, { prompt: event.target.value })}
                  required
                />
              </label>
              <div className="questionnaire-rule-grid">
                <label>
                  回答形式
                  <select
                    value={question.kind}
                    onChange={(event) =>
                      updateQuestion(questionIndex, { kind: event.target.value as QuestionnaireKind })
                    }
                  >
                    <option value="multi_select">複数選択</option>
                    <option value="ordinal">段階選択</option>
                    <option value="complement">組合せ評価</option>
                  </select>
                </label>
                <label>
                  最大選択数
                  <input
                    type="number"
                    min="1"
                    max={question.options.length}
                    value={question.maxSelections}
                    onChange={(event) => updateQuestion(questionIndex, { maxSelections: Number(event.target.value) })}
                  />
                </label>
                <label>
                  重み
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={question.weight}
                    onChange={(event) => updateQuestion(questionIndex, { weight: Number(event.target.value) })}
                  />
                </label>
              </div>
              <div className="questionnaire-options">
                <div className="result-section-heading">
                  <strong>選択肢</strong>
                  <span>{question.options.length}件</span>
                </div>
                {question.options.map((option, optionIndex) => (
                  <div className="questionnaire-option-row" key={`${question.axis}-${optionIndex}`}>
                    <label>
                      コード
                      <input
                        value={option.code}
                        maxLength={80}
                        onChange={(event) => updateOption(questionIndex, optionIndex, { code: event.target.value })}
                        required
                      />
                    </label>
                    <label>
                      表示名
                      <input
                        value={option.label}
                        maxLength={200}
                        onChange={(event) => updateOption(questionIndex, optionIndex, { label: event.target.value })}
                        required
                      />
                    </label>
                    <label>
                      点数（任意）
                      <input
                        type="number"
                        value={option.scoreValue ?? ""}
                        onChange={(event) =>
                          updateOption(questionIndex, optionIndex, {
                            scoreValue: event.target.value === "" ? null : Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <button
                      className="secondary"
                      type="button"
                      disabled={question.options.length <= 2}
                      onClick={() => removeOption(questionIndex, optionIndex)}
                    >
                      削除
                    </button>
                  </div>
                ))}
                <button className="secondary" type="button" onClick={() => addOption(questionIndex)}>
                  選択肢を追加
                </button>
              </div>
            </fieldset>
          ))}
        </div>
        {issues.length > 0 && (
          <div className="result-warning" role="alert">
            <strong>保存前に確認してください</strong>
            <ul>
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="table-settings-actions">
          <button disabled={busy || issues.length > 0}>{busy ? "保存中…" : "新しい版として保存"}</button>
        </div>
      </form>
      {message && (
        <div className="operation-feedback" role="status">
          <p>{message}</p>
        </div>
      )}
    </section>
  );
}
