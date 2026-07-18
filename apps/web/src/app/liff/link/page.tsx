import { eq } from "drizzle-orm";
import { events, getDatabase } from "@shime/db";
import {
  getLineClientConfig,
  parseLiffLinkQuery,
} from "../../../server/line-client-config";
import { LiffLinkClient } from "./liff-link-client";

export default async function LiffLinkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const { eventId, linkToken } = parseLiffLinkQuery(query);
  const event = eventId
    ? (
        await getDatabase()
          .select({ tenantId: events.tenantId, name: events.name })
          .from(events)
          .where(eq(events.id, eventId))
          .limit(1)
      )[0]
    : undefined;
  const lineConfig = event
    ? await getLineClientConfig(event.tenantId)
    : { liffId: "" };

  return (
    <LiffLinkClient
      eventId={eventId}
      eventName={event?.name ?? ""}
      linkToken={linkToken}
      liffId={lineConfig.liffId}
    />
  );
}
