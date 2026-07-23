import { describe, expect, it } from "vitest";
import { createDreamNo, FallbackDreamProvider, OpenAIDreamProvider, validateDreamText } from "@shime/core";
describe("dream fallback", () => {
  it("returns three candidates without AI", async () => {
    const provider = new FallbackDreamProvider({
      bridgeTemplate: "{card}から感じた願いは{wish}です",
      candidates: ["{wish}を育てる", "一歩進む", "周囲と分かち合う"],
    });
    const result = await provider.suggest({
      cardName: "希望",
      firstImpression: "明るい",
      relatedArea: "仕事",
      underlyingWish: "挑戦",
    });
    expect(result.source).toBe("fallback");
    expect(result.bridge.length).toBeLessThanOrEqual(220);
    expect(result.candidates).toHaveLength(3);
  });
  it("creates non-PII display numbers", () => expect(createDreamNo()).toMatch(/^D\d{10}$/));
  it("rejects an empty dream", () => expect(() => validateDreamText("  ")).toThrow());
  it("accepts a schema-constrained three-candidate AI response without sending free text", async () => {
    let requestBody = "";
    const fetcher: typeof fetch = async (_input, init) => {
      requestBody = String(init?.body);
      return new Response(
        JSON.stringify({
          choices: [
            { message: { content: JSON.stringify({ bridge: "橋渡し", candidates: ["候補1", "候補2", "候補3"] }) } },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const provider = new OpenAIDreamProvider({ apiKey: "test-key", model: "test-model", timeoutMs: 1000, fetcher });
    const result = await provider.suggest({
      cardName: "希望",
      firstImpression: "明るい",
      relatedArea: "未来",
      underlyingWish: "安心",
      freeText: "do-not-send",
    });
    const parsedRequest = JSON.parse(requestBody) as {
      response_format: { type: string; json_schema: { strict: boolean } };
    };
    expect(result.source).toBe("ai");
    expect(result.candidates).toHaveLength(3);
    expect(parsedRequest.response_format.type).toBe("json_schema");
    expect(parsedRequest.response_format.json_schema.strict).toBe(true);
    expect(requestBody).not.toContain("do-not-send");
  });
  it("rejects malformed AI responses so callers can use fallback", async () => {
    const fetcher: typeof fetch = async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 });
    const provider = new OpenAIDreamProvider({ apiKey: "test-key", model: "test-model", timeoutMs: 1000, fetcher });
    await expect(
      provider.suggest({ cardName: "a", firstImpression: "b", relatedArea: "c", underlyingWish: "d" }),
    ).rejects.toThrow("OPENAI_INVALID_RESPONSE");
  });
});
