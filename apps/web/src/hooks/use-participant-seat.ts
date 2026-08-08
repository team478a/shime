"use client";

import { useEffect, useState } from "react";

export type ParticipantSeat = {
  tableCode: string;
  seatCode: string;
  publishedAt: string;
};

type ParticipantSeatState = {
  seat: ParticipantSeat | null;
  status: "loading" | "loaded" | "error";
};

export function useParticipantSeat(eventId: string, enabled = true) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<ParticipantSeatState>({
    seat: null,
    status: "loading",
  });

  useEffect(() => {
    if (!eventId || !enabled) return;
    let active = true;
    void fetch(`/api/liff/events/${encodeURIComponent(eventId)}/seat`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return (await response.json()) as { data: ParticipantSeat | null };
      })
      .then((body) => {
        if (active) setState({ seat: body.data, status: "loaded" });
      })
      .catch(() => {
        if (active) setState({ seat: null, status: "error" });
      });
    return () => {
      active = false;
    };
  }, [enabled, eventId, refreshKey]);

  return {
    ...(enabled ? state : { seat: null, status: "loaded" as const }),
    refresh: () => {
      if (!enabled) return;
      setState((current) => ({ ...current, status: "loading" }));
      setRefreshKey((current) => current + 1);
    },
  };
}
