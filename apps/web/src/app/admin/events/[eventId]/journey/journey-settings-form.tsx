"use client";

import { useState } from "react";

import {
  type ParticipantJourneyStep,
  participantJourneyStepsSchema,
  STANDING_DIAGNOSIS_PARTICIPANT_JOURNEY,
} from "@shime/event-core/participant-journey-types";

const STEP_LABELS: Record<ParticipantJourneyStep["id"], string> = {
  dream: "Dream",
  questionnaire: "席案内5問",
  diagnosis: "SHIME診断",
  pass: "SHIME PASS・受付QR",
};

function move(steps: ParticipantJourneyStep[], index: number, offset: -1 | 1) {
  const target = index + offset;
  if (target < 0 || target >= steps.length) return steps;
  const next = [...steps];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return participantJourneyStepsSchema.safeParse(next).success ? next : steps;
}

function canMove(steps: ParticipantJourneyStep[], index: number, offset: -1 | 1) {
  return move(steps, index, offset) !== steps;
}

function toggleStep(steps: ParticipantJourneyStep[], stepId: ParticipantJourneyStep["id"]) {
  if (stepId === "pass") return steps;
  const next = steps.map((step) => (step.id === stepId ? { ...step, enabled: !step.enabled } : step));
  return participantJourneyStepsSchema.safeParse(next).success ? next : steps;
}

export function JourneySettingsForm({
  initialSteps,
  seatingMode,
  saveAction,
  publishAction,
}: {
  initialSteps: ParticipantJourneyStep[];
  seatingMode: "assigned" | "standing";
  saveAction: (formData: FormData) => void | Promise<void>;
  publishAction: (formData: FormData) => void | Promise<void>;
}) {
  const [steps, setSteps] = useState(initialSteps);
  const serialized = JSON.stringify(steps);

  return (
    <div className="admin-stack">
      <p>上下ボタンで順序を変更できます。公開するまで現在の参加者導線は変更されません。</p>
      {seatingMode === "standing" && (
        <div className="operation-note">
          <strong>立食イベント用</strong>
          <p>Dream → SHIME診断 → PASSの順にし、席案内5問を使わない導線を設定できます。</p>
          <button
            type="button"
            className="secondary"
            onClick={() => setSteps(STANDING_DIAGNOSIS_PARTICIPANT_JOURNEY.map((step) => ({ ...step })))}
          >
            立食＋診断導線を適用
          </button>
        </div>
      )}
      <ol className="journey-settings-list">
        {steps.map((step, index) => (
          <li className="admin-list-card" key={step.id}>
            <div>
              <span>ステップ {index + 1}</span>
              <strong>{STEP_LABELS[step.id]}</strong>
              <small>{step.enabled ? "参加者導線で使用" : "準備中（順序のみ予約・参加者には非表示）"}</small>
            </div>
            <div className="actions">
              {step.id !== "pass" && (
                <button
                  type="button"
                  className={step.enabled ? "secondary" : undefined}
                  onClick={() => setSteps((current) => toggleStep(current, step.id))}
                >
                  {step.enabled ? "導線から外す" : "導線に追加"}
                </button>
              )}
              <button
                type="button"
                className="secondary"
                disabled={!canMove(steps, index, -1)}
                onClick={() => setSteps((current) => move(current, index, -1))}
              >
                上へ
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!canMove(steps, index, 1)}
                onClick={() => setSteps((current) => move(current, index, 1))}
              >
                下へ
              </button>
            </div>
          </li>
        ))}
      </ol>
      <p className="participant-privacy">
        使用するDreamと席案内5問はSHIME
        PASSより前に配置します。SHIME診断は、イベントの診断設定をONにした後で公開できます。PASSは無効にできません。
      </p>
      <div className="actions">
        <form action={saveAction}>
          <input type="hidden" name="steps" value={serialized} />
          <button type="submit" className="secondary">
            下書き保存
          </button>
        </form>
        <form action={publishAction}>
          <input type="hidden" name="steps" value={serialized} />
          <button type="submit">この順序を公開</button>
        </form>
      </div>
    </div>
  );
}
