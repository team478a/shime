"use client";

import { useEffect, useState } from "react";
import { formatParticipantEventDate } from "../lib/participant-event";

type EventContext = {
  name: string;
  statusLabel: string;
  startsAt: string;
  endsAt: string | null;
  venueName: string | null;
  venueAddress: string | null;
};

export function ParticipantEventSummary({ eventId }: Readonly<{ eventId?: string | undefined }>) {
  const resolvedEventId = eventId ?? (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("eventId") ?? "");
  const [event, setEvent] = useState<EventContext | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!resolvedEventId) return;
    const controller = new AbortController();
    void fetch(`/api/liff/events/${encodeURIComponent(resolvedEventId)}`, { signal: controller.signal })
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (!response.ok) throw new Error(body.code);
        setEvent(body.data);
        setError("");
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("イベント情報を確認できませんでした。LINEの案内から開き直してください。");
      });
    return () => controller.abort();
  }, [resolvedEventId]);

  if (!resolvedEventId) return <p className="participant-event-error" role="alert">URLにイベント情報がありません。LINEの案内から開き直してください。</p>;
  if (error) return <p className="participant-event-error" role="alert">{error}</p>;
  if (!event) return <p className="participant-event-loading" role="status">イベント情報を確認しています…</p>;
  return (
    <section className="participant-event-summary" aria-label="参加イベント">
      <div><strong>{event.name}</strong><span>{event.statusLabel}</span></div>
      <dl>
        <dt>開催</dt><dd>{formatParticipantEventDate(event.startsAt)}</dd>
        <dt>会場</dt><dd>{event.venueName ?? "運営からご案内します"}</dd>
        {event.venueAddress && <><dt>住所</dt><dd>{event.venueAddress}</dd></>}
      </dl>
    </section>
  );
}
