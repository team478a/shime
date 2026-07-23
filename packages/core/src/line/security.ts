import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { hashSessionToken } from "../auth/session";

export const LINK_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;
export const PARTICIPANT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export function canReissueLinkToken(userId: string | null): boolean {
  return userId === null;
}
export function createOpaqueToken(pepper: string) {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashSessionToken(token, pepper) };
}
export function verifyWebhookSignature(rawBody: string, signature: string | null, channelSecret: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", channelSecret).update(rawBody).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function verifyLastFour(storedPhone: string | null, supplied: string) {
  const normalized = storedPhone?.replace(/\D/g, "");
  return Boolean(normalized && /^\d{4}$/.test(supplied) && normalized.endsWith(supplied));
}
