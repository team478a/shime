import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { matchChatMessageCipher } from "../../apps/web/src/server/match-chat-cipher";

const context = {
  tenantId: "tenant-a",
  eventId: "event-a",
  roomId: "room-a",
  senderParticipantId: "participant-a",
  clientMessageId: "11111111-1111-4111-8111-111111111111",
};

let previousKey: string | undefined;

beforeEach(() => {
  previousKey = process.env.SETTINGS_ENCRYPTION_KEY;
  process.env.SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

afterEach(() => {
  if (previousKey === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY;
  else process.env.SETTINGS_ENCRYPTION_KEY = previousKey;
});

describe("match chat message cipher", () => {
  it("encrypts without retaining plaintext and decrypts only in the same scope", async () => {
    const encrypted = await matchChatMessageCipher.encrypt("private message", context);

    expect(encrypted.version).toBe("v1");
    expect(encrypted.ciphertext).not.toContain("private message");
    await expect(matchChatMessageCipher.decrypt(encrypted.ciphertext, encrypted.version, context)).resolves.toBe(
      "private message",
    );
    await expect(
      matchChatMessageCipher.decrypt(encrypted.ciphertext, encrypted.version, {
        ...context,
        eventId: "another-event",
      }),
    ).rejects.toThrow();
  });

  it("fails closed when the encryption key is missing", async () => {
    delete process.env.SETTINGS_ENCRYPTION_KEY;
    await expect(matchChatMessageCipher.encrypt("private message", context)).rejects.toThrow();
  });
});
