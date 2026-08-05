"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type InteractionMemoNoteDto,
  type InteractionMemoTargetDto,
  interactionMemoTargetKey,
  type InteractionMemoWorkspaceDto,
  replaceInteractionMemoNote,
} from "../lib/interaction-memo-client";

type LoadStatus = "idle" | "loading" | "loaded" | "error";
export type InteractionMemoSaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";

type DesiredNote = {
  feelingCode: string;
  favorite: boolean;
};

type SaveState = {
  status: InteractionMemoSaveStatus;
  message?: string;
};

const GENERIC_SAVE_ERROR = "保存できませんでした。通信状態を確認して再試行してください。";
const CONFLICT_MESSAGE = "別の端末で更新されました。最新の内容を確認してください。";

async function fetchInteractionMemoWorkspace(eventId: string): Promise<InteractionMemoWorkspaceDto> {
  const response = await fetch(`/api/liff/events/${encodeURIComponent(eventId)}/interaction-memo`, {
    cache: "no-store",
  });
  const body = (await response.json()) as { data?: InteractionMemoWorkspaceDto };
  if (!response.ok || !body.data) throw new Error();
  return body.data;
}

function buildDesiredNote(
  current: InteractionMemoNoteDto | null | undefined,
  patch: Partial<DesiredNote>,
): DesiredNote {
  return {
    feelingCode: patch.feelingCode ?? current?.feelingCode ?? "",
    favorite: patch.favorite ?? current?.favorite ?? false,
  };
}

function matchesDesired(current: InteractionMemoNoteDto | null | undefined, desired: DesiredNote): boolean {
  return current?.feelingCode === desired.feelingCode && current.favorite === desired.favorite;
}

function buildOptimisticNote(
  target: InteractionMemoTargetDto,
  current: InteractionMemoNoteDto | null | undefined,
  desired: DesiredNote,
  revision: number,
  key: string,
): InteractionMemoNoteDto {
  return {
    id: current?.id ?? `pending-${key}`,
    interactionSlotId: target.interactionSlotId,
    targetParticipantId: target.targetParticipantId,
    feelingCode: desired.feelingCode,
    favorite: desired.favorite,
    revision,
    savedAt: current?.savedAt ?? new Date().toISOString(),
  };
}

export function useInteractionMemo(eventId: string, enabled = true) {
  const [workspace, setWorkspace] = useState<InteractionMemoWorkspaceDto | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>(enabled ? "loading" : "idle");
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const workspaceRef = useRef<InteractionMemoWorkspaceDto | null>(null);
  const serverNotesRef = useRef(new Map<string, InteractionMemoNoteDto>());
  const pendingRef = useRef(new Map<string, DesiredNote>());
  const savingRef = useRef(new Set<string>());

  const applyWorkspace = useCallback((next: InteractionMemoWorkspaceDto) => {
    workspaceRef.current = next;
    serverNotesRef.current = new Map(
      next.targets
        .filter((target): target is InteractionMemoTargetDto & { note: InteractionMemoNoteDto } => Boolean(target.note))
        .map((target) => [interactionMemoTargetKey(target), target.note]),
    );
    setWorkspace(next);
    setSaveStates({});
  }, []);

  useEffect(() => {
    if (!eventId || !enabled) return;
    let active = true;
    void fetchInteractionMemoWorkspace(eventId)
      .then((next) => {
        if (!active) return;
        applyWorkspace(next);
        setLoadStatus("loaded");
      })
      .catch(() => {
        if (active) setLoadStatus("error");
      });
    return () => {
      active = false;
    };
  }, [applyWorkspace, enabled, eventId]);

  const setSaveState = useCallback((key: string, state: SaveState) => {
    setSaveStates((current) => ({ ...current, [key]: state }));
  }, []);

  const drain = useCallback(
    async (target: InteractionMemoTargetDto) => {
      const key = interactionMemoTargetKey(target);
      if (savingRef.current.has(key)) return;
      savingRef.current.add(key);
      try {
        while (pendingRef.current.has(key)) {
          const desired = pendingRef.current.get(key)!;
          const serverNote = serverNotesRef.current.get(key);
          setSaveState(key, { status: "saving" });
          let response: Response;
          try {
            response = await fetch(
              `/api/liff/events/${encodeURIComponent(eventId)}/interaction-memo/${encodeURIComponent(target.interactionSlotId)}/${encodeURIComponent(target.targetParticipantId)}`,
              {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  ...desired,
                  expectedRevision: serverNote?.revision ?? 0,
                }),
              },
            );
          } catch {
            setSaveState(key, { status: "error", message: GENERIC_SAVE_ERROR });
            return;
          }

          const body = (await response.json().catch(() => null)) as {
            data?: InteractionMemoNoteDto;
            code?: string;
          } | null;
          if (!response.ok || !body?.data) {
            if (response.status === 409 && body?.code === "REVISION_CONFLICT") {
              pendingRef.current.delete(key);
              setSaveState(key, { status: "conflict", message: CONFLICT_MESSAGE });
            } else {
              setSaveState(key, { status: "error", message: GENERIC_SAVE_ERROR });
            }
            return;
          }

          serverNotesRef.current.set(key, body.data);
          const latest = pendingRef.current.get(key);
          if (latest && latest.feelingCode === desired.feelingCode && latest.favorite === desired.favorite) {
            pendingRef.current.delete(key);
            const next = replaceInteractionMemoNote(workspaceRef.current!, key, body.data);
            workspaceRef.current = next;
            setWorkspace(next);
            setSaveState(key, { status: "saved" });
          } else if (latest) {
            const optimistic = { ...body.data, ...latest };
            const next = replaceInteractionMemoNote(workspaceRef.current!, key, optimistic);
            workspaceRef.current = next;
            setWorkspace(next);
          }
        }
      } finally {
        savingRef.current.delete(key);
      }
    },
    [eventId, setSaveState],
  );

  const updateTarget = useCallback(
    (target: InteractionMemoTargetDto, patch: Partial<DesiredNote>) => {
      const key = interactionMemoTargetKey(target);
      const current = workspaceRef.current?.targets.find((item) => interactionMemoTargetKey(item) === key)?.note;
      const desired = buildDesiredNote(current, patch);
      if (!desired.feelingCode) return;
      if (matchesDesired(current, desired) && !pendingRef.current.has(key)) return;

      pendingRef.current.set(key, desired);
      const revision = serverNotesRef.current.get(key)?.revision ?? current?.revision ?? 0;
      const optimistic = buildOptimisticNote(target, current, desired, revision, key);
      const next = replaceInteractionMemoNote(workspaceRef.current!, key, optimistic);
      workspaceRef.current = next;
      setWorkspace(next);
      setSaveState(key, { status: "saving" });
      void drain(target);
    },
    [drain, setSaveState],
  );

  const refresh = useCallback(() => {
    if (!eventId || !enabled) return;
    setLoadStatus("loading");
    void fetchInteractionMemoWorkspace(eventId)
      .then((next) => {
        applyWorkspace(next);
        setLoadStatus("loaded");
      })
      .catch(() => setLoadStatus("error"));
  }, [applyWorkspace, enabled, eventId]);

  const retry = useCallback(
    (target: InteractionMemoTargetDto) => {
      const key = interactionMemoTargetKey(target);
      if (pendingRef.current.has(key)) void drain(target);
      else refresh();
    },
    [drain, refresh],
  );

  return {
    workspace,
    loadStatus: enabled ? loadStatus : "idle",
    saveStates,
    selectFeeling: (target: InteractionMemoTargetDto, feelingCode: string) => updateTarget(target, { feelingCode }),
    toggleFavorite: (target: InteractionMemoTargetDto) =>
      updateTarget(target, { favorite: !(target.note?.favorite ?? false) }),
    retry,
    refresh,
  };
}
