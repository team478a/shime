import "dotenv/config";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

const configSchema = z.object({
  events: z.array(z.object({ code: z.string().regex(/^rh-[a-z]-\d{8}$/) })).length(3),
});

async function main() {
  if (process.env.APP_ENV !== "staging") throw new Error("Rehearsal gate checks are restricted to APP_ENV=staging");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const configPath = process.argv[2] ?? "docs/shime/REHEARSAL_EVENT_CONFIG_20260715.yaml";
  const expectRhA01Rechecked = process.argv.includes("--expect-rh-a01-rechecked");
  const expectRhA01CheckinCancelled =
    !expectRhA01Rechecked && process.argv.includes("--expect-rh-a01-checkin-cancelled");
  const expectRhA01ManualCheckin =
    expectRhA01Rechecked || (!expectRhA01CheckinCancelled && process.argv.includes("--expect-rh-a01-manual-checkin"));
  const expectRhA01QrRotated =
    expectRhA01CheckinCancelled || expectRhA01ManualCheckin || process.argv.includes("--expect-rh-a01-qr-rotated");
  const expectRhA01Pass = expectRhA01QrRotated || process.argv.includes("--expect-rh-a01-pass");
  const expectRhA01Linked = expectRhA01Pass || process.argv.includes("--expect-rh-a01-linked");
  const config = configSchema.parse(parseYaml(await readFile(resolve(configPath), "utf8")));
  const tenantCode = process.env.BOOTSTRAP_TENANT_CODE ?? "shime";
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const rows = await sql<
      {
        code: string;
        status: string;
        participants: number;
        linked_participants: number;
        linked_rh_a01: number;
        rh_a01_dream_confirmed: number;
        rh_a01_questionnaire_submitted: number;
        rh_a01_pass_ready: number;
        rh_a01_number_assigned: number;
        rh_a01_active_qr: number;
        rh_a01_rotated_qr: number;
        rh_a01_checked_in: number;
        rh_a01_manual_checkin: number;
        rh_a01_cancelled_checkin: number;
        rh_a01_confirm_log: number;
        rh_a01_cancel_log: number;
        rh_a01_cancel_audit: number;
        active_link_tokens: number;
        notifications: number;
        pending_notifications: number;
      }[]
    >`
      select
        e.code,
        e.status,
        count(distinct p.id)::int as participants,
        count(distinct p.id) filter (where p.user_id is not null)::int as linked_participants,
        count(distinct p.id) filter (where p.user_id is not null and a.external_id = 'RH-A01')::int as linked_rh_a01,
        count(distinct p.id) filter (where a.external_id = 'RH-A01' and p.dream_state = 'confirmed')::int as rh_a01_dream_confirmed,
        count(distinct qr.id) filter (where a.external_id = 'RH-A01' and qr.status = 'submitted')::int as rh_a01_questionnaire_submitted,
        count(distinct lp.id) filter (where a.external_id = 'RH-A01' and lp.status in ('ready', 'checked_in'))::int as rh_a01_pass_ready,
        count(distinct p.id) filter (where a.external_id = 'RH-A01' and p.participant_number = 'A01')::int as rh_a01_number_assigned,
        count(distinct lp.id) filter (where a.external_id = 'RH-A01' and lp.qr_token_hash is not null and lp.qr_expires_at > now())::int as rh_a01_active_qr,
        count(distinct lp.id) filter (where a.external_id = 'RH-A01' and lp.qr_version >= 2 and lp.qr_token_hash is not null and lp.qr_expires_at > now())::int as rh_a01_rotated_qr,
        count(distinct ci.id) filter (where a.external_id = 'RH-A01' and ci.status = 'checked_in')::int as rh_a01_checked_in,
        count(distinct ci.id) filter (where a.external_id = 'RH-A01' and ci.status = 'checked_in' and ci.method = 'manual')::int as rh_a01_manual_checkin,
        count(distinct ci.id) filter (where a.external_id = 'RH-A01' and ci.status = 'cancelled' and ci.method = 'manual' and nullif(ci.cancellation_reason, '') is not null)::int as rh_a01_cancelled_checkin,
        count(distinct cil.id) filter (where a.external_id = 'RH-A01' and cil.action = 'confirmed' and cil.method = 'manual')::int as rh_a01_confirm_log,
        count(distinct cil.id) filter (where a.external_id = 'RH-A01' and cil.action = 'cancelled' and nullif(cil.reason, '') is not null and al.action = 'checkin.cancel' and cil.reason = al.reason)::int as rh_a01_cancel_log,
        count(distinct al.id) filter (where a.external_id = 'RH-A01' and al.action = 'checkin.cancel' and nullif(al.reason, '') is not null and cil.action = 'cancelled' and al.reason = cil.reason)::int as rh_a01_cancel_audit,
        count(distinct p.id) filter (where p.link_token_hash is not null and p.link_token_used_at is null and p.link_token_expires_at > now())::int as active_link_tokens,
        count(distinct n.id)::int as notifications,
        count(distinct n.id) filter (where n.status in ('queued', 'sending', 'failed'))::int as pending_notifications
      from tenants t
      join events e on e.tenant_id = t.id
      left join participants p on p.tenant_id = e.tenant_id and p.event_id = e.id
      left join applications a on a.tenant_id = p.tenant_id and a.event_id = p.event_id and a.id = p.application_id
      left join questionnaire_responses qr on qr.tenant_id = p.tenant_id and qr.event_id = p.event_id and qr.participant_id = p.id
      left join love_passports lp on lp.tenant_id = p.tenant_id and lp.event_id = p.event_id and lp.participant_id = p.id
      left join checkins ci on ci.tenant_id = p.tenant_id and ci.event_id = p.event_id and ci.participant_id = p.id
      left join checkin_logs cil on cil.tenant_id = p.tenant_id and cil.event_id = p.event_id and cil.participant_id = p.id
      left join audit_logs al on al.tenant_id = p.tenant_id and al.event_id = p.event_id and al.target_type = 'participant' and al.target_id = p.id
      left join notifications n on n.tenant_id = e.tenant_id and n.event_id = e.id
      where t.code = ${tenantCode} and e.code in ${sql(config.events.map((event) => event.code))}
      group by e.code, e.status
      order by e.code
    `;
    if (rows.length !== config.events.length)
      throw new Error("Not all rehearsal events were found in the active tenant");
    for (const row of rows) {
      if (row.status !== "draft" || row.participants !== 4)
        throw new Error(`${row.code} is not in the expected isolated draft state`);
      if (expectRhA01Linked) {
        const isRhA = row.code === "rh-a-20260715";
        const expectedLinked = isRhA ? 1 : 0;
        if (
          row.linked_participants !== expectedLinked ||
          row.linked_rh_a01 !== expectedLinked ||
          row.active_link_tokens !== 0
        ) {
          throw new Error(`${row.code} does not match the expected post-RH-A01 linkage state`);
        }
        if (expectRhA01Pass) {
          const expectedProgress = isRhA ? 1 : 0;
          if (
            row.rh_a01_dream_confirmed !== expectedProgress ||
            row.rh_a01_questionnaire_submitted !== expectedProgress ||
            row.rh_a01_pass_ready !== expectedProgress ||
            row.rh_a01_number_assigned !== expectedProgress ||
            row.rh_a01_active_qr !== expectedProgress
          ) {
            throw new Error(`${row.code} does not match the expected RH-A01 PASS-ready state`);
          }
          if (expectRhA01QrRotated && row.rh_a01_rotated_qr !== expectedProgress) {
            throw new Error(`${row.code} does not match the expected RH-A01 rotated-QR state`);
          }
          if (
            expectRhA01ManualCheckin &&
            (row.rh_a01_checked_in !== expectedProgress || row.rh_a01_manual_checkin !== expectedProgress)
          ) {
            throw new Error(`${row.code} does not match the expected RH-A01 manual-checkin state`);
          }
          if (
            expectRhA01CheckinCancelled &&
            (row.rh_a01_checked_in !== 0 ||
              row.rh_a01_manual_checkin !== 0 ||
              row.rh_a01_cancelled_checkin !== expectedProgress ||
              row.rh_a01_confirm_log !== expectedProgress ||
              row.rh_a01_cancel_log !== expectedProgress ||
              row.rh_a01_cancel_audit !== expectedProgress)
          ) {
            throw new Error(`${row.code} does not match the expected RH-A01 cancelled-checkin state`);
          }
          if (
            expectRhA01Rechecked &&
            (row.rh_a01_cancelled_checkin !== 0 ||
              row.rh_a01_confirm_log !== (isRhA ? 2 : 0) ||
              row.rh_a01_cancel_log !== expectedProgress ||
              row.rh_a01_cancel_audit !== expectedProgress)
          ) {
            throw new Error(`${row.code} does not match the expected RH-A01 rechecked state`);
          }
        }
      } else if (row.linked_participants !== 0 || row.linked_rh_a01 !== 0 || row.active_link_tokens !== 0) {
        throw new Error(`${row.code} already has LINE linkage or an active link token`);
      }
      if (row.notifications !== 0 || row.pending_notifications !== 0)
        throw new Error(`${row.code} already has notification records`);
    }
    console.info(
      JSON.stringify({
        status: "ok",
        expectation: expectRhA01Rechecked
          ? "rh-a01-rechecked"
          : expectRhA01CheckinCancelled
            ? "rh-a01-checkin-cancelled"
            : expectRhA01ManualCheckin
              ? "rh-a01-manual-checkin"
              : expectRhA01QrRotated
                ? "rh-a01-qr-rotated"
                : expectRhA01Pass
                  ? "rh-a01-pass-ready"
                  : expectRhA01Linked
                    ? "rh-a01-linked"
                    : "no-links",
        notificationSendSafe: true,
        events: rows.map((row) => ({
          code: row.code,
          eventStatus: row.status,
          participants: row.participants,
          linkedParticipants: row.linked_participants,
          linkedRhA01: row.linked_rh_a01,
          rhA01DreamConfirmed: row.rh_a01_dream_confirmed,
          rhA01QuestionnaireSubmitted: row.rh_a01_questionnaire_submitted,
          rhA01PassReady: row.rh_a01_pass_ready,
          rhA01NumberAssigned: row.rh_a01_number_assigned,
          rhA01ActiveQr: row.rh_a01_active_qr,
          rhA01RotatedQr: row.rh_a01_rotated_qr,
          rhA01CheckedIn: row.rh_a01_checked_in,
          rhA01ManualCheckin: row.rh_a01_manual_checkin,
          rhA01CancelledCheckin: row.rh_a01_cancelled_checkin,
          rhA01ConfirmLog: row.rh_a01_confirm_log,
          rhA01CancelLog: row.rh_a01_cancel_log,
          rhA01CancelAudit: row.rh_a01_cancel_audit,
          activeLinkTokens: row.active_link_tokens,
          notifications: row.notifications,
          pendingNotifications: row.pending_notifications,
        })),
      }),
    );
  } finally {
    await sql.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Rehearsal gate check failed");
  process.exitCode = 1;
});
