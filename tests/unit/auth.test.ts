import { describe, expect, it } from "vitest";
import { createSessionToken, hashPassword, hashSessionToken, nextLockout, verifyPassword } from "@shime/core";

const pepper = "test-pepper-that-is-longer-than-thirty-two-characters";
describe("staff authentication", () => {
  it("hashes passwords with Argon2id", async () => {
    const hash = await hashPassword("CorrectHorse123", pepper);
    expect(hash).toContain("$argon2id$");
    await expect(verifyPassword(hash, "CorrectHorse123", pepper)).resolves.toBe(true);
    await expect(verifyPassword(hash, "WrongPassword123", pepper)).resolves.toBe(false);
  });
  it("stores only a session token hash", () => {
    const session = createSessionToken(pepper);
    expect(session.token).not.toBe(session.tokenHash);
    expect(hashSessionToken(session.token, pepper)).toBe(session.tokenHash);
  });
  it("locks after five failed attempts", () => {
    expect(nextLockout(4)).toBeNull();
    expect(nextLockout(5)).toBeInstanceOf(Date);
  });
});
