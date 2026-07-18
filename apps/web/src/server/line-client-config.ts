import { and, eq } from "drizzle-orm";
import { getDatabase, tenantServiceSettings } from "@shime/db";

export function buildLinePublicUrls(
  liffId: string,
  appUrl: string | null | undefined,
  tenantCode?: string,
) {
  const origin = appUrl?.replace(/\/$/, "") ?? null;
  return {
    liffUrl: liffId ? `https://liff.line.me/${liffId}` : null,
    endpointUrl: origin ? `${origin}/liff/link` : null,
    webhookUrl:
      origin && tenantCode
        ? `${origin}/api/webhooks/line?tenant=${encodeURIComponent(tenantCode)}`
        : null,
  };
}

export function parseLiffLinkQuery(
  query: Record<string, string | string[] | undefined>,
) {
  const directEventId = typeof query.eventId === "string" ? query.eventId : "";
  const directLinkToken =
    typeof query.linkToken === "string" ? query.linkToken : "";
  if (directEventId && directLinkToken) {
    return { eventId: directEventId, linkToken: directLinkToken };
  }

  const state = typeof query["liff.state"] === "string" ? query["liff.state"] : "";
  const questionMark = state.indexOf("?");
  const stateQuery =
    questionMark >= 0
      ? state.slice(questionMark + 1)
      : state.startsWith("?")
        ? state.slice(1)
        : state;
  const params = new URLSearchParams(stateQuery);
  return {
    eventId: directEventId || params.get("eventId") || "",
    linkToken: directLinkToken || params.get("linkToken") || "",
  };
}

export async function getLineClientConfig(tenantId: string) {
  const setting = (await getDatabase().select().from(tenantServiceSettings).where(and(eq(tenantServiceSettings.tenantId, tenantId), eq(tenantServiceSettings.serviceKey, "line"))).limit(1))[0];
  if (setting && !setting.enabled) return { liffId: "", ...buildLinePublicUrls("", process.env.APP_URL) };
  const liffId = String(setting?.config.liffId ?? process.env.NEXT_PUBLIC_LIFF_ID ?? "");
  return { liffId, ...buildLinePublicUrls(liffId, process.env.APP_URL) };
}
