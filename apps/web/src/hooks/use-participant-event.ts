"use client";

import { useEffect, useState } from "react";

import type { ParticipantJourneyStep } from "@shime/event-core/participant-journey-types";

export type ParticipantEventContext = {
  name: string;
  statusLabel: string;
  startsAt: string;
  endsAt: string | null;
  venueName: string | null;
  venueAddress: string | null;
  participantJourney: ParticipantJourneyStep[];
  seatingMode: "assigned" | "standing";
};

const requests = new Map<string, Promise<ParticipantEventContext>>();

function loadParticipantEvent(eventId: string) {
  const existing = requests.get(eventId);
  if (existing) return existing;
  const request = fetch(`/api/liff/events/${encodeURIComponent(eventId)}`).then(async (response) => {
    const body = await response.json();
    if (!response.ok) throw new Error(body.code);
    return body.data as ParticipantEventContext;
  });
  requests.set(eventId, request);
  request.catch(() => requests.delete(eventId));
  return request;
}

export function useParticipantEvent(eventId: string) {
  const [event, setEvent] = useState<ParticipantEventContext | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    void loadParticipantEvent(eventId)
      .then((data) => {
        if (!active) return;
        setEvent(data);
        setError("");
      })
      .catch(() => {
        if (!active) return;
        setError("イベント情報を確認できませんでした。LINEの案内から開き直してください。");
      });
    return () => {
      active = false;
    };
  }, [eventId]);

  return { event, error };
}
