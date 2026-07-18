export type VerifiedLineIdentity = Readonly<{ lineUserId: string }>;
export type LineMessage = Readonly<{ type: "text"; text: string }>;

export interface LineProvider {
  verifyIdToken(idToken: string): Promise<VerifiedLineIdentity>;
  sendPush(lineUserId: string, messages: readonly LineMessage[]): Promise<{ messageId?: string }>;
}

export class LineProviderError extends Error {
  constructor(public readonly code: "INVALID_TOKEN" | "TOKEN_EXPIRED" | "PROVIDER_UNAVAILABLE" | "SEND_FAILED") { super(code); }
}

export class HttpLineProvider implements LineProvider {
  constructor(private readonly config: { channelId: string; channelAccessToken: string }) {}
  async verifyIdToken(idToken: string): Promise<VerifiedLineIdentity> {
    let response: Response;
    try { response = await fetch("https://api.line.me/oauth2/v2.1/verify", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ id_token: idToken, client_id: this.config.channelId }), signal: AbortSignal.timeout(8_000) }); }
    catch { throw new LineProviderError("PROVIDER_UNAVAILABLE"); }
    if (!response.ok) throw new LineProviderError(response.status >= 500 ? "PROVIDER_UNAVAILABLE" : "INVALID_TOKEN");
    const body = await response.json() as { sub?: string; exp?: number };
    if (!body.sub) throw new LineProviderError("INVALID_TOKEN"); if (body.exp && body.exp * 1000 <= Date.now()) throw new LineProviderError("TOKEN_EXPIRED");
    return { lineUserId: body.sub };
  }
  async sendPush(lineUserId: string, messages: readonly LineMessage[]) {
    let response: Response; try { response = await fetch("https://api.line.me/v2/bot/message/push", { method: "POST", headers: { authorization: `Bearer ${this.config.channelAccessToken}`, "content-type": "application/json" }, body: JSON.stringify({ to: lineUserId, messages }), signal: AbortSignal.timeout(8_000) }); } catch { throw new LineProviderError("PROVIDER_UNAVAILABLE"); }
    if (!response.ok) throw new LineProviderError("SEND_FAILED"); const messageId = response.headers.get("x-line-request-id"); return messageId ? { messageId } : {};
  }
}

export class FakeLineProvider implements LineProvider {
  readonly sent: Array<{ lineUserId: string; messages: readonly LineMessage[] }> = [];
  constructor(private readonly identities: ReadonlyMap<string, string> = new Map()) {}
  async verifyIdToken(idToken: string) { const lineUserId = this.identities.get(idToken); if (!lineUserId) throw new LineProviderError("INVALID_TOKEN"); return { lineUserId }; }
  async sendPush(lineUserId: string, messages: readonly LineMessage[]) { this.sent.push({ lineUserId, messages }); return { messageId: `fake-${this.sent.length}` }; }
}
