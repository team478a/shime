"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;
const getServerSnapshot = () => "";

export function getEventIdFromSearch(search: string): string {
  return new URLSearchParams(search).get("eventId") ?? "";
}

export function getMatchCandidateIdFromSearch(search: string): string {
  return new URLSearchParams(search).get("matchCandidateId") ?? "";
}

function getClientSnapshot(): string {
  return getEventIdFromSearch(window.location.search);
}

export function useLiffEventId(): string {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

function getMatchCandidateSnapshot(): string {
  return getMatchCandidateIdFromSearch(window.location.search);
}

export function useLiffMatchCandidateId(): string {
  return useSyncExternalStore(subscribe, getMatchCandidateSnapshot, getServerSnapshot);
}
