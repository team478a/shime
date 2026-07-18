import { randomInt } from "node:crypto";

export type DreamSuggestionInput = Readonly<{ cardName: string; firstImpression: string; relatedArea: string; underlyingWish: string; freeText?: string }>;
export type DreamSuggestionResult = Readonly<{ bridge: string; candidates: readonly [string, string, string]; source: "ai" | "fallback" }>;
export interface DreamSuggestionProvider { suggest(input: DreamSuggestionInput): Promise<DreamSuggestionResult>; }

function safeText(value: string): string {
  return value.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]").replace(/(?:\+?81|0)\d{1,4}[- ]?\d{1,4}[- ]?\d{3,4}/g, "[phone]").slice(0, 300);
}

export class OpenAIDreamProvider implements DreamSuggestionProvider {
  constructor(private readonly config: { apiKey: string; model: string; timeoutMs: number; fetcher?: typeof fetch }) {}
  async suggest(input: DreamSuggestionInput): Promise<DreamSuggestionResult> {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await (this.config.fetcher ?? fetch)("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${this.config.apiKey}`, "content-type": "application/json" }, signal: controller.signal, body: JSON.stringify({ model: this.config.model, response_format: { type: "json_schema", json_schema: { name: "dream_suggestions", strict: true, schema: { type: "object", additionalProperties: false, properties: { bridge: { type: "string" }, candidates: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } } }, required: ["bridge", "candidates"] } } }, messages: [{ role: "system", content: "日本語の婚活イベント用Dream作成補助です。個人情報を補完せず、bridgeは220文字以内、candidatesは3件、各500文字以内で返してください。" }, { role: "user", content: JSON.stringify({ cardName: safeText(input.cardName), firstImpression: safeText(input.firstImpression), relatedArea: safeText(input.relatedArea), underlyingWish: safeText(input.underlyingWish) }) }], max_completion_tokens: 800 }) });
      if (!response.ok) throw new Error(`OPENAI_HTTP_${response.status}`);
      const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> }; const content = json.choices?.[0]?.message?.content; if (!content) throw new Error("OPENAI_EMPTY_RESPONSE"); const parsed = JSON.parse(content) as { bridge?: unknown; candidates?: unknown };
      if (typeof parsed.bridge !== "string" || !Array.isArray(parsed.candidates) || parsed.candidates.length !== 3 || parsed.candidates.some((item) => typeof item !== "string")) throw new Error("OPENAI_INVALID_RESPONSE");
      return { bridge: parsed.bridge.slice(0, 220), candidates: parsed.candidates.map((item) => String(item).slice(0, 500)) as [string, string, string], source: "ai" };
    } finally { clearTimeout(timer); }
  }
}

export class FallbackDreamProvider implements DreamSuggestionProvider {
  constructor(private readonly config: { bridgeTemplate: string; candidates: readonly string[] }) {}
  async suggest(input: DreamSuggestionInput): Promise<DreamSuggestionResult> {
    const bridge = this.config.bridgeTemplate.replaceAll("{card}", input.cardName).replaceAll("{wish}", input.underlyingWish).slice(0, 220);
    const values = this.config.candidates.slice(0, 3).map((value) => value.replaceAll("{wish}", input.underlyingWish).slice(0, 500));
    while (values.length < 3) values.push(`${input.underlyingWish}を大切にする`);
    return { bridge, candidates: values as [string, string, string], source: "fallback" };
  }
}

export function createDreamNo(): string { return `D${randomInt(0, 10_000_000_000).toString().padStart(10, "0")}`; }
export function validateDreamText(text: string) { const normalized = text.trim(); if (!normalized || normalized.length > 500) throw new Error("Dream text must be between 1 and 500 characters"); return normalized; }
