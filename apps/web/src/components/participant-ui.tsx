import type { ParticipantJourneyKey } from "../lib/participant-journey";
import { ParticipantEventSummary } from "./participant-event-summary";
import { ParticipantJourneyNav } from "./participant-journey-nav";

export function ParticipantPageHeader({
  eyebrow,
  title,
  description,
  current,
  eventId,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  current?: ParticipantJourneyKey;
  eventId?: string;
}>) {
  return (
    <div className="participant-page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="participant-lead">{description}</p>
      {current && <ParticipantEventSummary eventId={eventId} />}
      {current && eventId && <ParticipantJourneyNav current={current} eventId={eventId} />}
    </div>
  );
}

export function ParticipantNotice({
  children,
  tone = "neutral",
}: Readonly<{
  children: React.ReactNode;
  tone?: "neutral" | "success" | "error";
}>) {
  return (
    <p className={`participant-notice participant-notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}
