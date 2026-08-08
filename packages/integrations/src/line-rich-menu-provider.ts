import { z } from "zod";
import type { LineRichMenuDefinition, LineRichMenuImage } from "./line-rich-menu-types";

const createResponseSchema = z.object({ richMenuId: z.string().min(1) });
const defaultResponseSchema = z.object({ richMenuId: z.string().min(1) });

export class LineRichMenuProviderError extends Error {
  constructor(
    readonly code: string,
    readonly status?: number,
  ) {
    super(code);
    this.name = "LineRichMenuProviderError";
  }
}

export interface LineRichMenuProvider {
  getDefault(): Promise<{ source: "messaging_api"; richMenuId: string } | { source: "none_or_manager" }>;
  validate(definition: LineRichMenuDefinition): Promise<void>;
  create(definition: LineRichMenuDefinition): Promise<string>;
  uploadImage(richMenuId: string, image: LineRichMenuImage): Promise<void>;
  setDefault(richMenuId: string): Promise<void>;
  clearDefault(): Promise<void>;
  delete(richMenuId: string): Promise<void>;
}

export interface LineRichMenuProviderFactory {
  get(tenantId: string): Promise<LineRichMenuProvider>;
}

export class HttpLineRichMenuProvider implements LineRichMenuProvider {
  constructor(
    private readonly accessToken: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async getDefault() {
    const response = await this.request("https://api.line.me/v2/bot/user/all/richmenu", { method: "GET" }, [404]);
    if (response.status === 404) return { source: "none_or_manager" } as const;
    const body = defaultResponseSchema.safeParse(await response.json().catch(() => null));
    if (!body.success) throw new LineRichMenuProviderError("LINE_RICH_MENU_INVALID_RESPONSE", response.status);
    return { source: "messaging_api", richMenuId: body.data.richMenuId } as const;
  }

  async validate(definition: LineRichMenuDefinition) {
    await this.request("https://api.line.me/v2/bot/richmenu/validate", this.jsonRequest(definition));
  }

  async create(definition: LineRichMenuDefinition) {
    const response = await this.request("https://api.line.me/v2/bot/richmenu", this.jsonRequest(definition));
    const body = createResponseSchema.safeParse(await response.json().catch(() => null));
    if (!body.success) throw new LineRichMenuProviderError("LINE_RICH_MENU_INVALID_RESPONSE", response.status);
    return body.data.richMenuId;
  }

  async uploadImage(richMenuId: string, image: LineRichMenuImage) {
    await this.request(`https://api-data.line.me/v2/bot/richmenu/${encodeURIComponent(richMenuId)}/content`, {
      method: "POST",
      headers: { "content-type": image.mimeType },
      body: new Uint8Array(image.bytes),
    });
  }

  async setDefault(richMenuId: string) {
    await this.request(`https://api.line.me/v2/bot/user/all/richmenu/${encodeURIComponent(richMenuId)}`, {
      method: "POST",
    });
  }

  async clearDefault() {
    await this.request("https://api.line.me/v2/bot/user/all/richmenu", { method: "DELETE" }, [404]);
  }

  async delete(richMenuId: string) {
    await this.request(
      `https://api.line.me/v2/bot/richmenu/${encodeURIComponent(richMenuId)}`,
      { method: "DELETE" },
      [404],
    );
  }

  private jsonRequest(body: unknown): RequestInit {
    return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
  }

  private async request(url: string, init: RequestInit, acceptedStatuses: readonly number[] = []) {
    let response: Response;
    try {
      response = await this.fetcher(url, {
        ...init,
        headers: { authorization: `Bearer ${this.accessToken}`, ...init.headers },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new LineRichMenuProviderError("LINE_RICH_MENU_UNAVAILABLE");
    }
    if (!response.ok && !acceptedStatuses.includes(response.status)) {
      throw new LineRichMenuProviderError("LINE_RICH_MENU_REQUEST_FAILED", response.status);
    }
    return response;
  }
}
