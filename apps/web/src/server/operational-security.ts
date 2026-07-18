import { createHash, timingSafeEqual } from "node:crypto";

const SAFE_FAILURE_CODES = new Set([
  "LINE_IDENTITY_MISSING",
  "INVALID_NOTIFICATION_PAYLOAD",
]);

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function hasValidBearerSecret(
  authorization: string | null,
  expectedSecret: string,
) {
  if (!authorization?.startsWith("Bearer ")) return false;
  const providedSecret = authorization.slice("Bearer ".length);
  return timingSafeEqual(digest(providedSecret), digest(expectedSecret));
}

export function notificationFailureCode(error: unknown) {
  if (error instanceof Error && SAFE_FAILURE_CODES.has(error.message)) {
    return error.message;
  }
  return "LINE_SEND_FAILED";
}
