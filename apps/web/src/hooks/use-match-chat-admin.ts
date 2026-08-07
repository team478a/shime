"use client";

import { useCallback, useEffect, useState } from "react";
import type { MatchChatAdminWorkspace, MatchChatConfig } from "@shime/match-chat";

async function readData<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as { data?: T; code?: string } | null;
  if (!response.ok || !payload?.data) throw new Error(payload?.code ?? "REQUEST_FAILED");
  return payload.data;
}

export function useMatchChatAdmin(eventId: string) {
  const [workspace, setWorkspace] = useState<MatchChatAdminWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/admin/events/${encodeURIComponent(eventId)}/match-chat`;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setWorkspace(await readData<MatchChatAdminWorkspace>(await fetch(base, { cache: "no-store" })));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "REQUEST_FAILED");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(base, { cache: "no-store", signal: controller.signal })
      .then((response) => readData<MatchChatAdminWorkspace>(response))
      .then((data) => setWorkspace(data))
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "REQUEST_FAILED");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [base]);

  const mutate = useCallback(
    async (path: string, method: "PUT" | "PATCH", body: unknown) => {
      setBusy(true);
      setError(null);
      try {
        await readData(
          await fetch(`${base}${path}`, {
            method,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }),
        );
        await refresh();
        return true;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "REQUEST_FAILED");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [base, refresh],
  );

  return {
    workspace,
    loading,
    busy,
    error,
    saveConfig: (config: MatchChatConfig) => mutate("", "PUT", config),
    updateReport: (reportId: string, status: "reviewing" | "resolved") =>
      mutate(`/reports/${encodeURIComponent(reportId)}`, "PATCH", { status }),
  };
}
