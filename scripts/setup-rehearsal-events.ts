import "dotenv/config";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import postgres from "postgres";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

const configSchema = z.object({
  baseUrl: z.string().url(),
  csvPath: z.string().min(1),
  tables: z
    .array(
      z.object({
        tableCode: z.string(),
        capacity: z.number().int().positive(),
        displayOrder: z.number().int().positive(),
        seats: z.array(z.object({ seatCode: z.string() })).min(1),
      }),
    )
    .min(1),
  dream: z.object({
    aiEnabled: z.boolean(),
    aiTimeoutMs: z.number().int(),
    projectConsentVersion: z.string().nullable(),
    fallbackBridgeTemplate: z.string(),
    fallbackCandidates: z.array(z.string()).length(3),
    cardSet: z.object({
      code: z.string(),
      name: z.string(),
      version: z.number().int().positive(),
      cards: z
        .array(z.object({ name: z.string(), imageKey: z.string().nullable(), description: z.string().nullable() }))
        .min(1),
    }),
  }),
  questionnaire: z.object({
    name: z.string(),
    version: z.number().int().positive(),
    questions: z
      .array(
        z.object({
          axis: z.enum(["values", "marriage_intent", "relationship_pace", "conversation_style", "topic_overlap"]),
          prompt: z.string(),
          kind: z.enum(["multi_select", "ordinal", "complement"]),
          maxSelections: z.number().int().positive(),
          weight: z.number().int().positive(),
          options: z
            .array(z.object({ code: z.string(), label: z.string(), scoreValue: z.number().int().nullable() }))
            .min(2),
        }),
      )
      .length(5),
  }),
  legalDocuments: z
    .array(
      z.object({
        documentType: z.enum(["event_terms", "privacy"]),
        version: z.string(),
        title: z.string(),
        body: z.string(),
      }),
    )
    .length(2),
  notificationTemplates: z.array(z.object({ templateKey: z.string(), name: z.string(), body: z.string() })).min(2),
  events: z
    .array(
      z.object({
        prefix: z.string().regex(/^RH-[A-Z]$/),
        questionnaireCode: z.string().regex(/^[a-z0-9_-]{2,80}$/),
        code: z.string().regex(/^rh-[a-z]-\d{8}$/),
        name: z.string().min(1),
        startsAt: z.coerce.date(),
        endsAt: z.coerce.date(),
        applicationOpensAt: z.coerce.date(),
        applicationClosesAt: z.coerce.date(),
        preferenceOpensAt: z.coerce.date(),
        preferenceClosesAt: z.coerce.date(),
        dreamRegistrationMode: z.enum(["required_private_allowed", "optional"]),
        preferenceMode: z.enum(["mutual_up_to_2", "first_choice_only", "ranked_up_to_3"]),
      }),
    )
    .length(3),
});

async function main() {
  const configPath = process.argv[2] ?? "docs/shime/REHEARSAL_EVENT_CONFIG_20260715.yaml";
  const config = configSchema.parse(parseYaml(await readFile(resolve(configPath), "utf8")));
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;
  const databaseUrl = process.env.DATABASE_URL;
  if (process.env.APP_ENV !== "staging") throw new Error("Rehearsal setup is restricted to APP_ENV=staging");
  if (!password || !databaseUrl) throw new Error("Staging administrator password and DATABASE_URL are required");

  const records = parse(await readFile(resolve(config.csvPath), "utf8"), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];
  const headers = Object.keys(records[0] ?? {});
  const csvValue = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
  const toCsv = (rows: Record<string, string>[]) =>
    `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvValue(row[header] ?? "")).join(",")).join("\n")}\n`;

  let cookie = "";
  const api = async (path: string, init?: RequestInit) => {
    const response = await fetch(new URL(path, config.baseUrl), {
      ...init,
      headers: { ...(init?.headers ?? {}), ...(cookie ? { cookie } : {}) },
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";", 1)[0] ?? cookie;
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        `API ${path} failed with HTTP ${response.status}: ${String((body as { code?: string }).code ?? "UNKNOWN")}`,
      );
    return body as { data?: unknown };
  };

  const sql = postgres(databaseUrl, { max: 1 });
  try {
    await api("/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantCode: process.env.BOOTSTRAP_TENANT_CODE ?? "shime",
        loginId: process.env.BOOTSTRAP_ADMIN_LOGIN_ID ?? "admin",
        password,
      }),
    });
    const tenantCode = process.env.BOOTSTRAP_TENANT_CODE ?? "shime";
    const tenantRows = await sql<
      { id: string }[]
    >`select id from tenants where code = ${tenantCode} and status = 'active' limit 1`;
    const tenantId = tenantRows[0]?.id;
    if (!tenantId) throw new Error("Active rehearsal tenant was not found");

    const list = await api("/api/admin/events");
    const existing = new Map(
      ((list.data ?? []) as Array<{ id: string; code: string }>).map((event) => [event.code, event.id]),
    );
    const results: Array<Record<string, string | number>> = [];
    const activeTemplates = await sql<
      { template_key: string }[]
    >`select template_key from notification_templates where tenant_id = ${tenantId} and active = true`;
    let templatesCreated = 0;
    for (const template of config.notificationTemplates)
      if (!activeTemplates.some((row) => row.template_key === template.templateKey)) {
        await api("/api/admin/platform/templates", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(template),
        });
        templatesCreated++;
      }

    for (const event of config.events) {
      let eventId = existing.get(event.code);
      if (!eventId) {
        const created = await api("/api/admin/events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...event,
            prefix: undefined,
            questionnaireCode: undefined,
            venueName: "staging検証会場",
            venueAddress: "検証専用（実在会場ではありません）",
            capacity: 4,
            allowMultipleMatches: false,
            participantCategories: [
              { code: "group_a", label: "グループA" },
              { code: "group_b", label: "グループB" },
            ],
            participantNumber: { groupAPrefix: "A", groupBPrefix: "B", digits: 2 },
            conversationRounds: 1,
            cardSetCode: "rehearsal-v1",
            retentionDays: 30,
            eventTermsVersion: "rehearsal-v1",
            privacyVersion: "rehearsal-v1",
            contactExchangeMode: "operator_mediated",
          }),
        });
        eventId = (created.data as { id: string }).id;
      }

      const selected = records.filter((row) => row.external_id?.startsWith(event.prefix));
      if (selected.length !== 4) throw new Error(`${event.code} must select exactly four synthetic rows`);
      const countsBefore = await sql<{ applications: number; participants: number }[]>`
      select
        count(distinct a.id)::int as applications,
        count(distinct p.id)::int as participants
      from applications a
      left join participants p on p.tenant_id = a.tenant_id and p.event_id = a.event_id and p.application_id = a.id
      where a.tenant_id = ${tenantId} and a.event_id = ${eventId} and a.external_id like ${`${event.prefix}%`}
    `;
      let validated = 0;
      let committed = 0;
      let createdParticipants = 0;
      if (countsBefore[0]?.applications !== 4 || countsBefore[0]?.participants !== 4) {
        const form = new FormData();
        form.set("mode", "all");
        form.set("file", new Blob([toCsv(selected)], { type: "text/csv;charset=utf-8" }), `${event.code}.csv`);
        const validation = await api(`/api/admin/events/${eventId}/imports`, { method: "POST", body: form });
        const validatedData = validation.data as { importId: string; success: number; warning: number; error: number };
        validated = validatedData.success + validatedData.warning;
        if (validatedData.error !== 0 || validated !== 4)
          throw new Error(`${event.code} CSV validation did not produce four committable rows`);
        const commit = await api(`/api/admin/events/${eventId}/imports/${validatedData.importId}/commit`, {
          method: "POST",
        });
        const committedData = commit.data as { committedRows: number; participantsCreated: number };
        committed = committedData.committedRows;
        createdParticipants = committedData.participantsCreated;
      }

      const tableResponse = await api(`/api/admin/events/${eventId}/tables`);
      const currentTables = (tableResponse.data ?? []) as Array<{
        tableCode: string;
        capacity: number;
        displayOrder: number;
        seats: Array<{ seatCode: string }>;
      }>;
      const normalizedTables = (tables: typeof currentTables) =>
        tables
          .map((table) => ({
            tableCode: table.tableCode,
            capacity: table.capacity,
            displayOrder: table.displayOrder,
            seats: table.seats
              .map((seat) => ({ seatCode: seat.seatCode }))
              .sort((a, b) => a.seatCode.localeCompare(b.seatCode)),
          }))
          .sort((a, b) => a.displayOrder - b.displayOrder);
      if (currentTables.length === 0)
        await api(`/api/admin/events/${eventId}/tables`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(config.tables),
        });
      else if (JSON.stringify(normalizedTables(currentTables)) !== JSON.stringify(normalizedTables(config.tables)))
        throw new Error(`${event.code} already has a different table configuration`);

      await api(`/api/admin/events/${eventId}/dream-settings`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...config.dream, registrationMode: event.dreamRegistrationMode }),
      });

      const linkedQuestionnaires = await sql<{ code: string; question_count: number }[]>`
      select q.code, count(qq.id)::int as question_count
      from event_questionnaires eqn
      join questionnaire_versions qv on qv.id = eqn.version_id and qv.tenant_id = eqn.tenant_id
      join questionnaires q on q.id = qv.questionnaire_id and q.tenant_id = qv.tenant_id
      left join questionnaire_questions qq on qq.version_id = qv.id and qq.tenant_id = qv.tenant_id
      where eqn.tenant_id = ${tenantId} and eqn.event_id = ${eventId}
      group by q.code
    `;
      if (linkedQuestionnaires.length === 0)
        await api(`/api/admin/events/${eventId}/questionnaire-settings`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: event.questionnaireCode, ...config.questionnaire }),
        });
      else if (
        linkedQuestionnaires[0]?.code !== event.questionnaireCode ||
        linkedQuestionnaires[0]?.question_count !== 5
      )
        throw new Error(`${event.code} already has a different questionnaire configuration`);

      const publishedDocuments = await sql<{ document_type: string; version: string }[]>`
      select document_type, version from legal_documents
      where tenant_id = ${tenantId} and event_id = ${eventId} and status = 'published'
    `;
      for (const document of config.legalDocuments)
        if (
          !publishedDocuments.some(
            (row) => row.document_type === document.documentType && row.version === document.version,
          )
        ) {
          const draft = await api(`/api/admin/events/${eventId}/legal-documents`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(document),
          });
          const documentId = (draft.data as { id: string }).id;
          await api(`/api/admin/events/${eventId}/legal-documents/${documentId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "publish" }),
          });
        }

      const resourceCounts = await sql<
        { table_count: number; seat_count: number; card_count: number; question_count: number; legal_count: number }[]
      >`
      select
        (select count(*)::int from event_tables where tenant_id = ${tenantId} and event_id = ${eventId}) as table_count,
        (select count(*)::int from event_seats where tenant_id = ${tenantId} and event_id = ${eventId} and enabled = true) as seat_count,
        (select count(*)::int from emotion_cards ec join event_dream_settings eds on eds.card_set_id = ec.card_set_id and eds.tenant_id = ec.tenant_id where eds.tenant_id = ${tenantId} and eds.event_id = ${eventId} and ec.active = true) as card_count,
        (select count(*)::int from questionnaire_questions qq join event_questionnaires eqn on eqn.version_id = qq.version_id and eqn.tenant_id = qq.tenant_id where eqn.tenant_id = ${tenantId} and eqn.event_id = ${eventId}) as question_count,
        (select count(*)::int from legal_documents where tenant_id = ${tenantId} and event_id = ${eventId} and status = 'published') as legal_count
    `;
      const resources = resourceCounts[0];
      if (
        !resources ||
        resources.table_count !== 2 ||
        resources.seat_count !== 4 ||
        resources.card_count !== 8 ||
        resources.question_count !== 5 ||
        resources.legal_count !== 2
      )
        throw new Error(`${event.code} master resource verification failed`);
      const countsAfter = await sql<{ applications: number; participants: number; cross_event_references: number }[]>`
      select
        count(distinct a.id)::int as applications,
        count(distinct p.id)::int as participants,
        count(distinct p.id) filter (where p.event_id <> a.event_id or p.tenant_id <> a.tenant_id)::int as cross_event_references
      from applications a
      left join participants p on p.application_id = a.id
      where a.tenant_id = ${tenantId} and a.event_id = ${eventId}
    `;
      if (
        countsAfter[0]?.applications !== 4 ||
        countsAfter[0]?.participants !== 4 ||
        countsAfter[0]?.cross_event_references !== 0
      )
        throw new Error(`${event.code} isolation verification failed`);
      const refreshed = await api("/api/admin/events");
      const configured = (
        (refreshed.data ?? []) as Array<{ id: string; configuration?: { complete?: boolean; issues?: unknown[] } }>
      ).find((item) => item.id === eventId)?.configuration;
      if (!configured?.complete)
        throw new Error(
          `${event.code} remains incomplete with ${configured?.issues?.length ?? "unknown"} configuration issues`,
        );
      results.push({
        code: event.code,
        eventId,
        validated,
        committed,
        participantsCreated: createdParticipants,
        applications: 4,
        participants: 4,
        crossEventReferences: 0,
        tables: 2,
        seats: 4,
        cards: 8,
        questions: 5,
        legalDocuments: 2,
        configurationIssues: 0,
      });
    }
    console.info(JSON.stringify({ status: "ok", templatesCreated, results }));
  } finally {
    if (cookie) await api("/api/admin/session", { method: "DELETE" }).catch(() => undefined);
    await sql.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Rehearsal setup failed");
  process.exitCode = 1;
});
