import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "shime_staff_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

export function createSessionToken(pepper: string): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashSessionToken(token, pepper) };
}

export function hashSessionToken(token: string, pepper: string): string {
  return createHash("sha256").update(`${token}\u0000${pepper}`).digest("hex");
}
