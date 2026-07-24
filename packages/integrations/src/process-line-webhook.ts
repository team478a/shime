import type {
  LineUserIdHasher,
  LineWebhookRepository,
  LineWebhookSecretProvider,
  LineWebhookSignatureVerifier,
  WebhookPepperProvider,
} from "./line-webhook-repository";
import { lineWebhookBodySchema } from "./line-webhook-types";
import type { LineWebhookEvent, ProcessLineWebhookResult, StoredLineWebhookEvent } from "./line-webhook-types";

type ProcessLineWebhookInput = {
  tenantCode: string;
  rawBody: string;
  signature: string | null;
};

export class ProcessLineWebhook {
  constructor(
    private readonly repository: LineWebhookRepository,
    private readonly secretProvider: LineWebhookSecretProvider,
    private readonly pepperProvider: WebhookPepperProvider,
    private readonly signatureVerifier: LineWebhookSignatureVerifier,
    private readonly hasher: LineUserIdHasher,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: ProcessLineWebhookInput): Promise<ProcessLineWebhookResult> {
    const tenantId = await this.repository.findTenantIdByCode(input.tenantCode);
    if (!tenantId) return { ok: false, code: "TENANT_NOT_FOUND", status: 404 };

    let secret: string;
    try {
      secret = await this.secretProvider.getSecret(tenantId);
    } catch {
      return { ok: false, code: "LINE_NOT_CONFIGURED", status: 503 };
    }
    if (!this.signatureVerifier(input.rawBody, input.signature, secret)) {
      return { ok: false, code: "INVALID_SIGNATURE", status: 401 };
    }

    const body = this.parseBody(input.rawBody);
    if (!body) return { ok: false, code: "INVALID_BODY", status: 400 };

    const pepper = this.pepperProvider.getPepper();
    await this.repository.storeIfNew(
      tenantId,
      body.events.map((event) => this.toStoredEvent(event, pepper)),
    );
    return { ok: true };
  }

  private parseBody(rawBody: string) {
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return null;
    }
    const parsed = lineWebhookBodySchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  }

  private toStoredEvent(event: LineWebhookEvent, pepper: string): StoredLineWebhookEvent {
    return {
      webhookEventId: event.webhookEventId,
      eventType: event.type,
      lineUserIdHash: event.source?.userId ? this.hasher.hash(event.source.userId, pepper) : null,
      occurredAt: event.timestamp ? new Date(event.timestamp) : null,
      processedAt: this.now(),
    };
  }
}
