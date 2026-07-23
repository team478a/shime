import { afterEach, describe, expect, it } from "vitest";
import { decryptSecrets, encryptSecrets } from "../../apps/web/src/server/secret-store";

const original = process.env.SETTINGS_ENCRYPTION_KEY;
afterEach(() => {
  if (original === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY;
  else process.env.SETTINGS_ENCRYPTION_KEY = original;
});
describe("encrypted tenant secrets", () => {
  it("round trips secrets without embedding plaintext", () => {
    process.env.SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const value = encryptSecrets({ apiKey: "sensitive-value" });
    expect(value.encrypted).not.toContain("sensitive-value");
    expect(value.fingerprint).toHaveLength(12);
    expect(decryptSecrets(value.encrypted)).toEqual({ apiKey: "sensitive-value" });
  });
  it("rejects an invalid encryption key", () => {
    process.env.SETTINGS_ENCRYPTION_KEY = "short";
    expect(() => encryptSecrets({ token: "value" })).toThrow();
  });
});
