"use client";

import { useEffect, useState } from "react";
import type { OperationsAnalyticsWorkspace } from "@shime/operations-analytics";

export function useOperationsAnalytics(eventId: string) {
  const [data, setData] = useState<OperationsAnalyticsWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const path = `/api/admin/events/${encodeURIComponent(eventId)}/communication-analytics`;
    void fetch(path, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          data?: OperationsAnalyticsWorkspace;
          code?: string;
        } | null;
        if (!response.ok || !payload?.data) throw new Error(payload?.code ?? "REQUEST_FAILED");
        return payload.data;
      })
      .then(setData)
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "REQUEST_FAILED");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [eventId]);

  return { data, loading, error };
}
