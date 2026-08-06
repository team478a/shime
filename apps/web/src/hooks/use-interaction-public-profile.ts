"use client";

import { useCallback, useState } from "react";
import type { InteractionPublicProfileDto } from "../lib/interaction-memo-client";

type Status = "closed" | "loading" | "open" | "error";

export function useInteractionPublicProfile(eventId: string, targetParticipantId: string) {
  const [profile, setProfile] = useState<InteractionPublicProfileDto | null>(null);
  const [status, setStatus] = useState<Status>("closed");

  const toggle = useCallback(async () => {
    if (status === "open") return setStatus("closed");
    if (profile) return setStatus("open");
    setStatus("loading");
    try {
      const response = await fetch(
        `/api/liff/events/${encodeURIComponent(eventId)}/interactions/${encodeURIComponent(targetParticipantId)}/profile`,
        { cache: "no-store" },
      );
      const body = (await response.json().catch(() => null)) as { data?: InteractionPublicProfileDto } | null;
      if (!response.ok || !body?.data) throw new Error();
      setProfile(body.data);
      setStatus("open");
    } catch {
      setStatus("error");
    }
  }, [eventId, profile, status, targetParticipantId]);

  return { profile, status, toggle };
}
