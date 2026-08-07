"use client";

import { useEffect, useState } from "react";

export type EventResult = {
  available: boolean;
  matched?: boolean;
  matchChatEnabled?: boolean;
  matches?: Array<{ matchCandidateId: string; participantNumber: string | null; nickname: string | null }>;
};

export function useEventResult(eventId: string) {
  const [result, setResult] = useState<EventResult | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loaded" | "error">("idle");

  useEffect(() => {
    if (!eventId) return;
    const controller = new AbortController();
    fetch(`/api/liff/events/${encodeURIComponent(eventId)}/result`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => ({ response, body: (await response.json()) as { data?: EventResult } }))
      .then(({ response, body }) => {
        if (!response.ok || !body.data) throw new Error("RESULT_UNAVAILABLE");
        setResult(body.data);
        setLoadState("loaded");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState("error");
      });
    return () => controller.abort();
  }, [eventId]);

  return { result, loadState };
}
