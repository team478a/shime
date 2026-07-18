import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";

function key(): Buffer {
  const value = z.string().min(32).parse(process.env.SETTINGS_ENCRYPTION_KEY);
  const decoded = /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64");
  if (decoded.length !== 32) throw new Error("SETTINGS_ENCRYPTION_KEY_INVALID");
  return decoded;
}

export function encryptSecrets(secrets: Record<string, string>): { encrypted: string; fingerprint: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(secrets), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join("."),
    fingerprint: createHash("sha256").update(plaintext).digest("hex").slice(0, 12),
  };
}

export function decryptSecrets(value: string): Record<string, string> {
  const [version, ivText, tagText, ciphertextText] = value.split(".");
  if (version !== "v1" || !ivText || !tagText || !ciphertextText) throw new Error("ENCRYPTED_SECRET_INVALID");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]);
  const parsed = JSON.parse(plaintext.toString("utf8"));
  return z.record(z.string(), z.string()).parse(parsed);
}
