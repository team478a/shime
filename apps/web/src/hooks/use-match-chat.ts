"use client";

import { useCallback, useEffect, useState } from "react";

type Room = {
  id: string;
  status: "pending_consent" | "open" | "blocked" | "closed";
  opensAt: string | null;
  closesAt: string;
  termsVersion: string;
  maxMessageLength: number;
  participantConsented: boolean;
};

export type MatchChatMessageDto = {
  id: string;
  sender: "self" | "match";
  body: string;
  sentAt: string;
};

type RequestState = "idle" | "loading" | "ready" | "unavailable" | "error";

const errorMessage = (code?: string) => {
  if (code === "MATCH_CHAT_EXPIRED") return "このチャットの利用期間は終了しました。";
  if (code === "MATCH_CHAT_BLOCKED") return "このチャットは停止されています。";
  if (code === "MATCH_CHAT_RATE_LIMITED") return "短時間の送信回数が上限に達しました。少し待ってください。";
  if (code === "MATCH_CHAT_DISABLED" || code === "MATCH_CHAT_NOT_AVAILABLE")
    return "このチャットは現在利用できません。";
  return "処理を完了できませんでした。通信状態を確認してください。";
};

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = (await response.json().catch(() => null)) as { data?: T; code?: string } | null;
  if (!response.ok || !body?.data) throw new Error(errorMessage(body?.code));
  return body.data;
}

export function useMatchChat(eventId: string, matchCandidateId: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<MatchChatMessageDto[]>([]);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [operationMessage, setOperationMessage] = useState("");
  const [sending, setSending] = useState(false);

  const roomUrl = room
    ? `/api/liff/events/${encodeURIComponent(eventId)}/match-chat/rooms/${encodeURIComponent(room.id)}`
    : "";

  const loadRoom = useCallback(async () => {
    if (!eventId || !matchCandidateId) return;
    setRequestState("loading");
    try {
      const next = await jsonRequest<Room>(`/api/liff/events/${encodeURIComponent(eventId)}/match-chat/rooms`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ matchCandidateId }),
      });
      setRoom(next);
      setRequestState("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : errorMessage();
      setOperationMessage(message);
      setRequestState(message.includes("現在利用できません") ? "unavailable" : "error");
    }
  }, [eventId, matchCandidateId]);

  const refreshMessages = useCallback(async () => {
    if (!roomUrl || room?.status !== "open") return;
    try {
      const data = await jsonRequest<{ messages: MatchChatMessageDto[] }>(`${roomUrl}/messages`);
      setMessages(data.messages);
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : errorMessage());
    }
  }, [room?.status, roomUrl]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRoom(), 0);
    return () => window.clearTimeout(timer);
  }, [loadRoom]);
  useEffect(() => {
    if (!eventId || !matchCandidateId || room?.status !== "pending_consent") return;
    const timer = window.setInterval(async () => {
      try {
        const next = await jsonRequest<Room>(`/api/liff/events/${encodeURIComponent(eventId)}/match-chat/rooms`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ matchCandidateId }),
        });
        setRoom(next);
        if (next.status === "open") setOperationMessage("双方の同意が完了しました。");
      } catch {
        // A temporary polling failure must not discard the participant's consent state.
      }
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [eventId, matchCandidateId, room?.status]);
  useEffect(() => {
    if (room?.status !== "open") return;
    const initial = window.setTimeout(() => void refreshMessages(), 0);
    const timer = window.setInterval(() => void refreshMessages(), 5_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refreshMessages, room?.status]);

  const acceptTerms = useCallback(async () => {
    if (!room || !roomUrl) return;
    setOperationMessage("");
    try {
      const next = await jsonRequest<Omit<Room, "termsVersion" | "maxMessageLength"> & Partial<Room>>(
        `${roomUrl}/consent`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ termsVersion: room.termsVersion }),
        },
      );
      setRoom((current) => (current ? { ...current, ...next, participantConsented: true } : current));
      setOperationMessage(
        next.status === "open" ? "チャットを開始できます。" : "同意しました。お相手の同意を待っています。",
      );
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : errorMessage());
    }
  }, [room, roomUrl]);

  const send = useCallback(
    async (body: string) => {
      if (!room || !roomUrl || !body.trim() || sending) return false;
      setSending(true);
      setOperationMessage("");
      try {
        const message = await jsonRequest<MatchChatMessageDto>(`${roomUrl}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ clientMessageId: crypto.randomUUID(), body: body.trim() }),
        });
        setMessages((current) => [...current.filter((item) => item.id !== message.id), message]);
        return true;
      } catch (error) {
        setOperationMessage(error instanceof Error ? error.message : errorMessage());
        return false;
      } finally {
        setSending(false);
      }
    },
    [room, roomUrl, sending],
  );

  const stop = useCallback(
    async (kind: "block" | "report", report?: { category: string; detail: string | null }) => {
      if (!roomUrl) return false;
      setOperationMessage("");
      try {
        const request: RequestInit = {
          method: "POST",
          headers: { "content-type": "application/json" },
        };
        if (kind === "report") request.body = JSON.stringify(report);
        await jsonRequest(`${roomUrl}/${kind === "block" ? "block" : "reports"}`, request);
        setRoom((current) => (current ? { ...current, status: "blocked" } : current));
        setMessages([]);
        setOperationMessage(
          kind === "report" ? "通報を受け付け、チャットを停止しました。" : "チャットを停止しました。",
        );
        return true;
      } catch (error) {
        setOperationMessage(error instanceof Error ? error.message : errorMessage());
        return false;
      }
    },
    [roomUrl],
  );

  return {
    room,
    messages,
    requestState,
    operationMessage,
    sending,
    loadRoom,
    refreshMessages,
    acceptTerms,
    send,
    block: () => stop("block"),
    report: (category: string, detail: string) => stop("report", { category, detail: detail.trim() || null }),
  };
}
