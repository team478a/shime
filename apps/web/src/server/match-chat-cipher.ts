import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { MatchChatCipherContext, MatchChatMessageCipher } from "@shime/match-chat";

const VERSION = "v1";

function key(): Buffer {
  const value = z.string().min(32).parse(process.env.SETTINGS_ENCRYPTION_KEY);
  const source = /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64");
  if (source.length !== 32) throw new Error("MATCH_CHAT_ENCRYPTION_KEY_INVALID");
  return createHash("sha256").update(source).update("shime:match-chat:v1", "utf8").digest();
}

function additionalData(context: MatchChatCipherContext): Buffer {
  return Buffer.from(
    [context.tenantId, context.eventId, context.roomId, context.senderParticipantId, context.clientMessageId].join(":"),
    "utf8",
  );
}

export const matchChatMessageCipher: MatchChatMessageCipher = {
  async encrypt(body, context) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key(), iv);
    cipher.setAAD(additionalData(context));
    const ciphertext = Buffer.concat([cipher.update(body, "utf8"), cipher.final()]);
    return {
      version: VERSION,
      ciphertext: [
        iv.toString("base64url"),
        cipher.getAuthTag().toString("base64url"),
        ciphertext.toString("base64url"),
      ].join("."),
    };
  },
  async decrypt(value, version, context) {
    if (version !== VERSION) throw new Error("MATCH_CHAT_ENCRYPTION_VERSION_UNSUPPORTED");
    const [ivText, tagText, ciphertextText] = value.split(".");
    if (!ivText || !tagText || !ciphertextText) throw new Error("MATCH_CHAT_CIPHERTEXT_INVALID");
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "base64url"));
    decipher.setAAD(additionalData(context));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString(
      "utf8",
    );
  },
};
