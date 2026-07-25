"use client";

import { useCallback, useEffect, useState } from "react";

type DiagnosisQuestion = {
  axisCode: string;
  prompt: string;
  supplementalText: string;
  required: boolean;
  displayOrder: number;
  options: Array<{ code: string; label: string; displayOrder: number }>;
};

type DiagnosisCard = {
  id: string;
  title: string;
  message: string;
  altText: string;
  emotionCode: string;
  displayOrder: number;
  imageUrl: string;
};

export type DiagnosisAnswer = { axisCode: string; optionCode: string };

export type DiagnosisView = {
  diagnosis: {
    copy: {
      pageTitle: string;
      intro: string;
      instructions: string;
      completionTitle: string;
      completionBody: string;
      startButton: string;
      nextButton: string;
      backButton: string;
      completeButton: string;
    };
    reportCopy: {
      title: string;
      heading: string;
      fixedText: string;
      disclaimer: string;
      guidance: string;
    };
    questions: DiagnosisQuestion[];
    cards: DiagnosisCard[];
  };
  access: { opensAt: string | null; closesAt: string | null; allowResubmission: boolean };
  session: {
    id: string;
    status: "in_progress" | "submitted";
    revision: number;
    selectedCardAssetVersionId: string | null;
    submittedAt: string | null;
  } | null;
  answers: DiagnosisAnswer[];
  result: {
    primaryEmotion: { code: string; label: string; description: string };
    card: { assetVersionId: string; title: string; message: string };
    axes: Array<{ axisCode: string; prompt: string; optionCode: string; optionLabel: string }>;
  } | null;
};

const errorMessages: Record<string, string> = {
  DIAGNOSIS_NOT_CONFIGURED: "SHIME診断はまだ準備されていません。",
  DIAGNOSIS_DISABLED: "SHIME診断は現在利用できません。",
  DIAGNOSIS_NOT_OPEN: "SHIME診断の開始時刻前です。",
  DIAGNOSIS_CLOSED: "SHIME診断の回答期間は終了しました。",
  DIAGNOSIS_SNAPSHOT_INVALID: "診断設定を確認できませんでした。運営スタッフへお知らせください。",
  DIAGNOSIS_REVISION_CONFLICT: "別の画面で回答が更新されました。最新内容を読み込み直しました。",
};

async function readResponse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessages[body.code] ?? "処理を完了できませんでした。");
  return body.data;
}

export function useDiagnosis(eventId: string) {
  const [view, setView] = useState<DiagnosisView | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoadState("loading");
    try {
      const data = (await readResponse(
        await fetch(`/api/liff/events/${encodeURIComponent(eventId)}/diagnosis`, { cache: "no-store" }),
      )) as DiagnosisView;
      setView(data);
      setMessage("");
      setLoadState("loaded");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "診断を読み込めませんでした。");
      setLoadState("error");
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function start(restart = false) {
    setBusy(true);
    try {
      await readResponse(
        await fetch(`/api/liff/events/${encodeURIComponent(eventId)}/diagnosis/start`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ restart }),
        }),
      );
      await load();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "診断を開始できませんでした。");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(selectedCardAssetVersionId: string, answers: DiagnosisAnswer[]) {
    if (!view?.session) return null;
    setBusy(true);
    try {
      const data = (await readResponse(
        await fetch(`/api/liff/events/${encodeURIComponent(eventId)}/diagnosis`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedRevision: view.session.revision,
            selectedCardAssetVersionId,
            answers,
          }),
        }),
      )) as { revision: number };
      setView((current) =>
        current?.session
          ? { ...current, session: { ...current.session, revision: data.revision }, answers }
          : current,
      );
      setMessage("回答を保存しました。");
      return data.revision;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "回答を保存できませんでした。");
      await load();
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function submit(expectedRevision: number) {
    setBusy(true);
    try {
      await readResponse(
        await fetch(`/api/liff/events/${encodeURIComponent(eventId)}/diagnosis/submit`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ expectedRevision }),
        }),
      );
      await load();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "回答を提出できませんでした。");
      await load();
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { view, loadState, message, busy, start, save, submit };
}
