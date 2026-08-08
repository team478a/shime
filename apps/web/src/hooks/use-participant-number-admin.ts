"use client";

import { useCallback, useState } from "react";

type AssignmentResult = {
  participantNumber: string;
  swappedParticipantId?: string;
  swappedParticipantNumber?: string;
};
type AssignmentResponse = { data: AssignmentResult | null; code: string | null };

export function useParticipantNumberAdmin(eventId: string) {
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const assign = useCallback(
    async (participantId: string, participantNumber: string): Promise<AssignmentResponse> => {
      setBusyId(participantId);
      setError(null);
      try {
        const response = await fetch(
          `/api/admin/events/${encodeURIComponent(eventId)}/participants/${encodeURIComponent(participantId)}/number`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ participantNumber }),
          },
        );
        const payload = (await response.json().catch(() => null)) as { data?: AssignmentResult; code?: string } | null;
        if (!response.ok || !payload?.data) {
          const code = payload?.code ?? "REQUEST_FAILED";
          setError(code);
          return { data: null, code };
        }
        return { data: payload.data, code: null };
      } catch {
        setError("REQUEST_FAILED");
        return { data: null, code: "REQUEST_FAILED" };
      } finally {
        setBusyId("");
      }
    },
    [eventId],
  );

  return { assign, busyId, error, clearError: () => setError(null) };
}
