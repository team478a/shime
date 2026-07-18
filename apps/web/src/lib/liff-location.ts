"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;
const getServerSnapshot = () => "";

export function getEventIdFromSearch(search: string): string {
  return new URLSearchParams(search).get("eventId") ?? "";
}

function getClientSnapshot(): string {
  return getEventIdFromSearch(window.location.search);
}

export function useLiffEventId(): string {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
