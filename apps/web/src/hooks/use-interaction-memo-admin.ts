"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CreateInteractionMemoDraftInput,
  InteractionMemoAdminSnapshot,
  InteractionMemoAdminWorkspace,
} from "@shime/interactions";

async function readData<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as { data?: T; code?: string } | null;
  if (!response.ok || !payload?.data) throw new Error(payload?.code ?? "REQUEST_FAILED");
  return payload.data;
}

export function useInteractionMemoAdmin(eventId: string) {
  const [snapshots, setSnapshots] = useState<InteractionMemoAdminSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const workspace = await readData<InteractionMemoAdminWorkspace>(
        await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/interaction-memo-snapshots`, {
          cache: "no-store",
        }),
      );
      setSnapshots(workspace.snapshots);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "REQUEST_FAILED");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/events/${encodeURIComponent(eventId)}/interaction-memo-snapshots`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => readData<InteractionMemoAdminWorkspace>(response))
      .then((workspace) => setSnapshots(workspace.snapshots))
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "REQUEST_FAILED");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [eventId]);

  const mutate = useCallback(
    async (path: string, body?: CreateInteractionMemoDraftInput) => {
      setBusy(true);
      setError(null);
      try {
        const request: RequestInit = body
          ? {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            }
          : { method: "POST" };
        await readData<InteractionMemoAdminSnapshot>(
          await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/interaction-memo-snapshots${path}`, request),
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
    [eventId, refresh],
  );

  return {
    snapshots,
    loading,
    busy,
    error,
    createDraft: (input: CreateInteractionMemoDraftInput) => mutate("", input),
    publish: (snapshotId: string) => mutate(`/${encodeURIComponent(snapshotId)}/publish`),
    stop: (snapshotId: string) => mutate(`/${encodeURIComponent(snapshotId)}/stop`),
  };
}
