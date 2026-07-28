import "dotenv/config";

import { createHash, randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { conciergeTemplatePayloadSchema, validateConciergeTemplateForPublish } from "@shime/core";
import postgres from "postgres";
import sharp from "sharp";
import { z } from "zod";

import { sanitizeConciergeCardImage } from "../apps/web/src/server/concierge-card-image";
import {
  CONCIERGE_REHEARSAL_CARDS,
  CONCIERGE_REHEARSAL_TEMPLATE_KEY,
  CONCIERGE_REHEARSAL_TEMPLATE_NAME,
  createConciergeRehearsalPayload,
  parseConciergeRehearsalArgs,
} from "./concierge-rehearsal-config";

const baseEnvSchema = z.object({
  APP_ENV: z.literal("staging"),
  DATABASE_URL: z.string().min(1),
  BOOTSTRAP_TENANT_CODE: z.string().min(1).default("shime"),
});

const storageEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_CONCIERGE_BUCKET: z.string().min(1).default("shime-private-concierge"),
});

type Target = { tenant_id: string; event_id: string; actor_user_id: string };
type CardVersion = { id: string; asset_id: string; status: string };

async function createSyntheticImage(color: string) {
  const source = await sharp({
    create: { width: 1_024, height: 1_024, channels: 4, background: color },
  })
    .png()
    .toBuffer();
  return sanitizeConciergeCardImage({
    bytes: source,
    declaredMimeType: "image/png",
    fileName: "synthetic-card.png",
  });
}

async function main() {
  const env = baseEnvSchema.parse(process.env);
  const input = parseConciergeRehearsalArgs(process.argv.slice(2));
  const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });
  try {
    const targets = await sql<Target[]>`
      select t.id as tenant_id, e.id as event_id, u.id as actor_user_id
      from tenants t
      join events e on e.tenant_id = t.id
      join lateral (
        select users.id
        from users
        join staff_roles on staff_roles.tenant_id = users.tenant_id and staff_roles.user_id = users.id
        where users.tenant_id = t.id and users.status = 'active' and staff_roles.role = 'system_admin'
        order by users.created_at
        limit 1
      ) u on true
      where t.code = ${env.BOOTSTRAP_TENANT_CODE}
        and e.code = ${input.eventCode}
        and e.status in ('draft', 'accepting')
      limit 1
    `;
    const target = targets[0];
    if (!target) throw new Error("ISOLATED_REHEARSAL_EVENT_NOT_FOUND");

    const existing = await sql<
      {
        assets: number;
        published_cards: number;
        published_templates: number;
        snapshots: number;
        enabled_snapshots: number;
      }[]
    >`
      select
        count(distinct ca.id)::int as assets,
        count(distinct cav.id) filter (where cav.status = 'published')::int as published_cards,
        (select count(*)::int from concierge_template_versions ctv
          join concierge_templates ct on ct.id = ctv.template_id and ct.tenant_id = ctv.tenant_id
          where ct.tenant_id = ${target.tenant_id}
            and ct.template_key = ${CONCIERGE_REHEARSAL_TEMPLATE_KEY}
            and ctv.status = 'published') as published_templates,
        (select count(*)::int from event_concierge_snapshots
          where tenant_id = ${target.tenant_id} and event_id = ${target.event_id}) as snapshots,
        (select count(*)::int from event_concierge_snapshots
          where tenant_id = ${target.tenant_id} and event_id = ${target.event_id} and enabled) as enabled_snapshots
      from concierge_card_assets ca
      left join concierge_card_asset_versions cav
        on cav.tenant_id = ca.tenant_id and cav.asset_id = ca.id
      where ca.tenant_id = ${target.tenant_id}
        and ca.code in ${sql(CONCIERGE_REHEARSAL_CARDS.map((card) => `rehearsal_${card.code}`))}
    `;
    const before = existing[0]!;
    if (before.enabled_snapshots !== 0) throw new Error("DIAGNOSIS_MUST_BE_DISABLED_BEFORE_SETUP");
    if (!input.apply) {
      console.info(
        JSON.stringify({
          status: "dry-run",
          eventCode: input.eventCode,
          diagnosisEnabled: false,
          existing: before,
          planned: { cards: 8, templateVersions: 1, snapshots: 1 },
        }),
      );
      return;
    }

    const storageEnv = storageEnvSchema.parse(process.env);
    const storage = createClient(storageEnv.SUPABASE_URL, storageEnv.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const bucket = await storage.storage.getBucket(storageEnv.SUPABASE_CONCIERGE_BUCKET);
    if (bucket.error || !bucket.data || bucket.data.public) throw new Error("PRIVATE_CONCIERGE_BUCKET_REQUIRED");

    const cardVersionIds: string[] = [];
    let cardsCreated = 0;
    for (const card of CONCIERGE_REHEARSAL_CARDS) {
      const code = `rehearsal_${card.code}`;
      const found = await sql<CardVersion[]>`
        select cav.id, ca.id as asset_id, cav.status
        from concierge_card_assets ca
        join concierge_card_asset_versions cav
          on cav.tenant_id = ca.tenant_id and cav.asset_id = ca.id
        where ca.tenant_id = ${target.tenant_id}
          and ca.module_key = 'concierge'
          and ca.code = ${code}
          and cav.status = 'published'
        order by cav.version desc
        limit 1
      `;
      if (found[0]) {
        cardVersionIds.push(found[0].id);
        continue;
      }
      const assetId = randomUUID();
      const versionId = randomUUID();
      const image = await createSyntheticImage(card.color);
      const objectKey =
        `tenants/${target.tenant_id}/modules/concierge/cards/${assetId}/v1/` + `${image.contentHash}.webp`;
      const uploaded = await storage.storage.from(storageEnv.SUPABASE_CONCIERGE_BUCKET).upload(objectKey, image.bytes, {
        contentType: image.mimeType,
        upsert: false,
      });
      if (uploaded.error) throw new Error("CONCIERGE_STORAGE_UPLOAD_FAILED");
      await sql.begin(async (tx) => {
        await tx`
          insert into concierge_card_assets
            (id, tenant_id, module_key, code, name, created_by)
          values
            (${assetId}, ${target.tenant_id}, 'concierge', ${code}, ${`[検証専用] ${card.label}`},
             ${target.actor_user_id})
        `;
        await tx`
          insert into concierge_card_asset_versions
            (id, tenant_id, asset_id, version, status, title, message, alt_text, storage_object_key,
             mime_type, byte_size, width, height, pixel_count, content_hash, published_at, created_by)
          values
            (${versionId}, ${target.tenant_id}, ${assetId}, 1, 'published', ${card.label},
             ${card.description}, ${`${card.label}を表す検証専用カード`}, ${objectKey},
             ${image.mimeType}, ${image.byteSize}, ${image.width}, ${image.height}, ${image.pixelCount},
             ${image.contentHash}, now(), ${target.actor_user_id})
        `;
        await tx`
          insert into audit_logs
            (tenant_id, actor_user_id, action, target_type, target_id, after_json, reason, request_id)
          values
            (${target.tenant_id}, ${target.actor_user_id}, 'concierge.rehearsal_card.prepare',
             'concierge_card_asset_version', ${versionId},
             ${tx.json({ code, version: 1, status: "published", contentHash: image.contentHash })},
             'staging synthetic concierge rehearsal', ${randomUUID()})
        `;
      });
      cardVersionIds.push(versionId);
      cardsCreated += 1;
    }

    const payload = createConciergeRehearsalPayload(cardVersionIds);
    let templateCreated = false;
    let versionRows = await sql<{ id: string; template_id: string; version: number; payload_json: unknown }[]>`
      select ctv.id, ctv.template_id, ctv.version, ctv.payload_json
      from concierge_template_versions ctv
      join concierge_templates ct on ct.tenant_id = ctv.tenant_id and ct.id = ctv.template_id
      where ct.tenant_id = ${target.tenant_id}
        and ct.template_key = ${CONCIERGE_REHEARSAL_TEMPLATE_KEY}
        and ctv.status = 'published'
      order by ctv.version desc
      limit 1
    `;
    if (!versionRows[0]) {
      const templateId = randomUUID();
      const versionId = randomUUID();
      await sql.begin(async (tx) => {
        await tx`
          insert into concierge_templates
            (id, tenant_id, module_key, template_key, name, created_by)
          values
            (${templateId}, ${target.tenant_id}, 'concierge', ${CONCIERGE_REHEARSAL_TEMPLATE_KEY},
             ${CONCIERGE_REHEARSAL_TEMPLATE_NAME}, ${target.actor_user_id})
        `;
        await tx`
          insert into concierge_template_versions
            (id, tenant_id, template_id, version, schema_version, status, payload_json, published_at, created_by)
          values
            (${versionId}, ${target.tenant_id}, ${templateId}, 1, 1, 'published', ${tx.json(payload)},
             now(), ${target.actor_user_id})
        `;
        await tx`
          insert into audit_logs
            (tenant_id, actor_user_id, action, target_type, target_id, after_json, reason, request_id)
          values
            (${target.tenant_id}, ${target.actor_user_id}, 'concierge.rehearsal_template.prepare',
             'concierge_template_version', ${versionId},
             ${tx.json({ templateKey: CONCIERGE_REHEARSAL_TEMPLATE_KEY, version: 1, status: "published" })},
             'staging synthetic concierge rehearsal', ${randomUUID()})
        `;
      });
      versionRows = [{ id: versionId, template_id: templateId, version: 1, payload_json: payload }];
      templateCreated = true;
    }
    const templateVersion = versionRows[0]!;
    const persistedPayload = conciergeTemplatePayloadSchema.parse(templateVersion.payload_json);
    if (validateConciergeTemplateForPublish(persistedPayload).length) {
      throw new Error("EXISTING_REHEARSAL_TEMPLATE_INVALID");
    }
    const persistedCardIds = persistedPayload.cardMappings
      .filter((mapping) => mapping.active)
      .map((mapping) => mapping.cardAssetVersionId)
      .sort();
    if (
      persistedCardIds.length !== cardVersionIds.length ||
      persistedCardIds.some((cardId, index) => cardId !== [...cardVersionIds].sort()[index])
    ) {
      throw new Error("EXISTING_REHEARSAL_TEMPLATE_MISMATCH");
    }
    const cardVersions = await sql<
      {
        id: string;
        asset_id: string;
        version: number;
        title: string;
        message: string;
        alt_text: string;
        storage_object_key: string;
        mime_type: string;
        content_hash: string;
        width: number;
        height: number;
      }[]
    >`
      select id, asset_id, version, title, message, alt_text, storage_object_key,
        mime_type, content_hash, width, height
      from concierge_card_asset_versions
      where tenant_id = ${target.tenant_id} and id in ${sql(cardVersionIds)}
      order by id
    `;
    if (cardVersions.length !== 8) throw new Error("EIGHT_PUBLISHED_CARDS_REQUIRED");
    const snapshot = {
      schemaVersion: 1,
      template: persistedPayload,
      cards: cardVersions.map((card) => ({
        id: card.id,
        assetId: card.asset_id,
        version: card.version,
        title: card.title,
        message: card.message,
        altText: card.alt_text,
        storageObjectKey: card.storage_object_key,
        mimeType: card.mime_type,
        contentHash: card.content_hash,
        width: card.width,
        height: card.height,
      })),
    };
    const snapshotHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
    const saved = await sql<{ id: string }[]>`
      insert into event_concierge_snapshots
        (tenant_id, event_id, template_version_id, template_version, snapshot_json, snapshot_hash,
         enabled, allow_resubmission, applied_by)
      values
        (${target.tenant_id}, ${target.event_id}, ${templateVersion.id}, ${templateVersion.version},
         ${sql.json(snapshot)}, ${snapshotHash}, false, false, ${target.actor_user_id})
      on conflict (tenant_id, event_id) do update set
        template_version_id = excluded.template_version_id,
        template_version = excluded.template_version,
        snapshot_json = excluded.snapshot_json,
        snapshot_hash = excluded.snapshot_hash,
        enabled = false,
        access_opens_at = null,
        access_closes_at = null,
        allow_resubmission = false,
        applied_by = excluded.applied_by,
        applied_at = now()
      returning id
    `;
    await sql`
      insert into audit_logs
        (tenant_id, actor_user_id, event_id, action, target_type, target_id, after_json, reason, request_id)
      values
        (${target.tenant_id}, ${target.actor_user_id}, ${target.event_id},
         'concierge.rehearsal_snapshot.prepare', 'event_concierge_snapshot', ${saved[0]!.id},
         ${sql.json({ templateVersion: templateVersion.version, snapshotHash, enabled: false })},
         'staging synthetic concierge rehearsal', ${randomUUID()})
    `;
    console.info(
      JSON.stringify({
        status: "applied",
        eventCode: input.eventCode,
        cardsCreated,
        templateCreated,
        snapshotReady: true,
        diagnosisEnabled: false,
      }),
    );
  } finally {
    await sql.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "CONCIERGE_REHEARSAL_SETUP_FAILED");
  process.exitCode = 1;
});
