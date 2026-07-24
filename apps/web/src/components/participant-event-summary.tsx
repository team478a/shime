"use client";

import { useParticipantEvent } from "../hooks/use-participant-event";
import { formatParticipantEventDate } from "../lib/participant-event";

export function ParticipantEventSummary({ eventId }: Readonly<{ eventId?: string | undefined }>) {
  const resolvedEventId =
    eventId ??
    (typeof window === "undefined" ? "" : (new URLSearchParams(window.location.search).get("eventId") ?? ""));
  const { event, error } = useParticipantEvent(resolvedEventId);

  if (!resolvedEventId)
    return (
      <p className="participant-event-error" role="alert">
        URLにイベント情報がありません。LINEの案内から開き直してください。
      </p>
    );
  if (error)
    return (
      <p className="participant-event-error" role="alert">
        {error}
      </p>
    );
  if (!event)
    return (
      <p className="participant-event-loading" role="status">
        イベント情報を確認しています…
      </p>
    );
  return (
    <section className="participant-event-summary" aria-label="参加イベント">
      <div>
        <strong>{event.name}</strong>
        <span>{event.statusLabel}</span>
      </div>
      <dl>
        <dt>開催</dt>
        <dd>{formatParticipantEventDate(event.startsAt)}</dd>
        <dt>会場</dt>
        <dd>{event.venueName ?? "運営からご案内します"}</dd>
        {event.venueAddress && (
          <>
            <dt>住所</dt>
            <dd>{event.venueAddress}</dd>
          </>
        )}
      </dl>
    </section>
  );
}
