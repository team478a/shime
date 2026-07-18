export function buildLiffApplicationLink(liffId: string, eventId: string, linkToken: string): string | null {
  if (!liffId.trim() || !eventId.trim() || !linkToken.trim()) return null;
  const query = new URLSearchParams({ eventId, linkToken });
  return `https://liff.line.me/${encodeURIComponent(liffId.trim())}?${query.toString()}`;
}

export function buildLiffEventEntryLink(liffId: string, eventId: string): string | null {
  if (!liffId.trim() || !eventId.trim()) return null;
  const query = new URLSearchParams({ eventId });
  return `https://liff.line.me/${encodeURIComponent(liffId.trim())}?${query.toString()}`;
}
