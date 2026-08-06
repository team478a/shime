"use client";

import { useCallback, useState } from "react";
import type { InteractionMemoTargetCandidateDto, InteractionMemoTargetDto } from "../lib/interaction-memo-client";

type Status = "idle" | "searching" | "confirming" | "saving" | "cancelling" | "error";

async function readJson(response: Response) {
  return (await response.json().catch(() => null)) as { data?: unknown; code?: string; message?: string } | null;
}

export function useInteractionTargetRegistration(eventId: string, onChanged: () => void) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<InteractionMemoTargetCandidateDto[]>([]);
  const [selected, setSelected] = useState<InteractionMemoTargetCandidateDto | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const search = useCallback(async () => {
    const normalized = query.trim();
    if (!normalized) {
      setMessage("参加者番号を1文字以上入力してください。");
      setStatus("error");
      return;
    }
    setStatus("searching");
    setMessage("");
    setSelected(null);
    try {
      const response = await fetch(
        `/api/liff/events/${encodeURIComponent(eventId)}/interaction-memo/target-candidates?${new URLSearchParams({ q: normalized })}`,
        { cache: "no-store" },
      );
      const body = await readJson(response);
      if (!response.ok || !Array.isArray(body?.data)) throw new Error();
      setCandidates(body.data as InteractionMemoTargetCandidateDto[]);
      setMessage(body.data.length === 0 ? "候補が見つかりません。番号を確認してください。" : "");
      setStatus("idle");
    } catch {
      setCandidates([]);
      setMessage("候補を読み込めませんでした。通信状態を確認してください。");
      setStatus("error");
    }
  }, [eventId, query]);

  const confirm = useCallback(async () => {
    if (!selected) return;
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch(`/api/liff/events/${encodeURIComponent(eventId)}/interaction-memo/slots`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetParticipantId: selected.targetParticipantId }),
      });
      const body = await readJson(response);
      if (!response.ok || !body?.data) throw new Error();
      setQuery("");
      setCandidates([]);
      setSelected(null);
      setMessage(`${selected.participantNumber}を会話相手に追加しました。`);
      setStatus("idle");
      onChanged();
    } catch {
      setMessage("会話相手を追加できませんでした。候補を選び直してください。");
      setStatus("error");
    }
  }, [eventId, onChanged, selected]);

  const cancel = useCallback(
    async (target: InteractionMemoTargetDto) => {
      setStatus("cancelling");
      setMessage("");
      try {
        const response = await fetch(
          `/api/liff/events/${encodeURIComponent(eventId)}/interaction-memo/slots/${encodeURIComponent(target.interactionSlotId)}/${encodeURIComponent(target.targetParticipantId)}`,
          { method: "DELETE" },
        );
        const body = await readJson(response);
        if (!response.ok) {
          setMessage(body?.message ?? "会話相手を取り消せませんでした。");
          setStatus("error");
          return;
        }
        setMessage("誤登録を取り消しました。");
        setStatus("idle");
        onChanged();
      } catch {
        setMessage("取り消せませんでした。通信状態を確認してください。");
        setStatus("error");
      }
    },
    [eventId, onChanged],
  );

  return {
    query,
    setQuery,
    candidates,
    selected,
    status,
    message,
    search,
    choose: (candidate: InteractionMemoTargetCandidateDto) => {
      setSelected(candidate);
      setStatus("confirming");
      setMessage("");
    },
    closeConfirmation: () => {
      setSelected(null);
      setStatus("idle");
    },
    confirm,
    cancel,
  };
}
