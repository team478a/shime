type OperationalLevel = "info" | "warn" | "error";

type OperationalLog = {
  level: OperationalLevel;
  event: string;
  requestId: string;
  route: string;
  code?: string;
  durationMs?: number;
  processed?: number;
  sent?: number;
  failed?: number;
};

/**
 * PIIや任意のError文字列を受け取らない、運用用の許可リスト型ログ。
 */
export function writeOperationalLog(entry: OperationalLog) {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...entry,
  });

  if (entry.level === "error") console.error(payload);
  else if (entry.level === "warn") console.warn(payload);
  else console.info(payload);
}
