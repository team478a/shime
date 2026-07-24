"use client";

import { useParticipantEvent } from "../hooks/use-participant-event";
import {
  buildParticipantJourneyUrl,
  getParticipantJourney,
  type ParticipantJourneyKey,
} from "../lib/participant-journey";

export function ParticipantJourneyNav({ current, eventId }: { current: ParticipantJourneyKey; eventId: string }) {
  const { event } = useParticipantEvent(eventId);
  const stages = getParticipantJourney(event?.participantJourney);

  return (
    <nav className="participant-journey" aria-label="イベント参加の進行">
      <ol>
        {stages.map((stage) => (
          <li key={stage.key} aria-current={stage.key === current ? "step" : undefined}>
            <span>{stage.label}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ParticipantNextLink({ current, eventId }: { current?: ParticipantJourneyKey; eventId: string }) {
  const { event } = useParticipantEvent(eventId);
  if (!event) return null;
  const stages = getParticipantJourney(event.participantJourney);
  const currentIndex = current ? stages.findIndex((stage) => stage.key === current) : -1;
  const next = stages[currentIndex + 1];
  if (!next) return null;

  return (
    <a className="button-link" href={buildParticipantJourneyUrl(next.key, eventId)}>
      {current ? "次へ進む" : `${next.label}へ進む`}
    </a>
  );
}
