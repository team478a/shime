import "dotenv/config";

import { randomUUID } from "node:crypto";
import postgres from "postgres";

import { parseRehearsalSeatingSetup } from "./rehearsal-seating-config";

async function main() {
  if (process.env.APP_ENV !== "staging") throw new Error("STAGING_ONLY");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");
  const input = parseRehearsalSeatingSetup(process.argv.slice(2));
  const tenantCode = process.env.BOOTSTRAP_TENANT_CODE ?? "shime";
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const result = await sql.begin(async (tx) => {
      const targets = await tx<{
        tenant_id: string;
        event_id: string;
        participant_id: string;
        participant_user_id: string | null;
        version_id: string;
      }[]>`
        select t.id as tenant_id, e.id as event_id, p.id as participant_id,
          p.user_id as participant_user_id, eq.version_id
        from tenants t
        join events e on e.tenant_id = t.id
        join applications a on a.tenant_id = e.tenant_id and a.event_id = e.id
        join participants p on p.tenant_id = a.tenant_id and p.event_id = a.event_id and p.application_id = a.id
        join event_questionnaires eq on eq.tenant_id = e.tenant_id and eq.event_id = e.id
        where t.code = ${tenantCode} and e.code = ${input.eventCode}
          and a.external_id = ${input.externalId} and a.status = 'confirmed'
        limit 1
      `;
      const target = targets[0];
      if (!target) throw new Error("SYNTHETIC_PARTICIPANT_NOT_FOUND");
      if (target.participant_user_id) throw new Error("LINKED_PARTICIPANT_MUST_NOT_BE_AUTOMATED");

      const actors = await tx<{ id: string }[]>`
        select u.id
        from users u
        join staff_roles sr on sr.tenant_id = u.tenant_id and sr.user_id = u.id
        where u.tenant_id = ${target.tenant_id} and u.status = 'active' and sr.role = 'system_admin'
        order by u.created_at
        limit 1
      `;
      const actor = actors[0];
      if (!actor) throw new Error("SYSTEM_ADMIN_NOT_FOUND");

      const existingResponses = await tx<{ id: string; status: string }[]>`
        select id, status from questionnaire_responses
        where tenant_id = ${target.tenant_id} and event_id = ${target.event_id}
          and participant_id = ${target.participant_id}
        limit 1
      `;
      let responseId = existingResponses[0]?.id;
      let responseCreated = false;
      if (existingResponses[0] && existingResponses[0].status !== "submitted") throw new Error("EXISTING_RESPONSE_MUST_NOT_BE_OVERWRITTEN");
      if (!responseId) {
        const responses = await tx<{ id: string }[]>`
          insert into questionnaire_responses
            (tenant_id, event_id, participant_id, version_id, status, submitted_at)
          values
            (${target.tenant_id}, ${target.event_id}, ${target.participant_id}, ${target.version_id}, 'submitted', now())
          returning id
        `;
        responseId = responses[0]!.id;
        const questions = await tx<{ question_id: string; option_code: string }[]>`
          select q.id as question_id,
            (select qo.code from questionnaire_options qo
              where qo.tenant_id = q.tenant_id and qo.question_id = q.id
              order by qo.display_order limit 1) as option_code
          from questionnaire_questions q
          where q.tenant_id = ${target.tenant_id} and q.version_id = ${target.version_id}
          order by q.display_order
        `;
        if (questions.length !== 5 || questions.some((question) => !question.option_code)) throw new Error("FIVE_CONFIGURED_QUESTIONS_REQUIRED");
        for (const question of questions) {
          await tx`
            insert into questionnaire_answers
              (tenant_id, event_id, response_id, question_id, option_codes_json, declined)
            values
              (${target.tenant_id}, ${target.event_id}, ${responseId}, ${question.question_id}, ${tx.json([question.option_code])}, false)
          `;
        }
        responseCreated = true;
      }

      const answerCounts = await tx<{ count: number }[]>`
        select count(*)::int as count from questionnaire_answers
        where tenant_id = ${target.tenant_id} and event_id = ${target.event_id} and response_id = ${responseId}
      `;
      if (answerCounts[0]?.count !== 5) throw new Error("SUBMITTED_RESPONSE_MUST_HAVE_FIVE_ANSWERS");

      const existingCheckins = await tx<{ id: string; status: string; method: string }[]>`
        select id, status, method from checkins
        where tenant_id = ${target.tenant_id} and event_id = ${target.event_id}
          and participant_id = ${target.participant_id}
        limit 1
      `;
      let checkinCreated = false;
      if (!existingCheckins[0]) {
        const checkins = await tx<{ id: string }[]>`
          insert into checkins
            (tenant_id, event_id, participant_id, status, checked_in_at, checked_in_by, method)
          values
            (${target.tenant_id}, ${target.event_id}, ${target.participant_id}, 'checked_in', now(), ${actor.id}, 'manual')
          returning id
        `;
        await tx`
          insert into checkin_logs
            (tenant_id, event_id, participant_id, checkin_id, action, method, actor_user_id, reason)
          values
            (${target.tenant_id}, ${target.event_id}, ${target.participant_id}, ${checkins[0]!.id}, 'confirmed', 'manual', ${actor.id}, 'staging seating rehearsal setup')
        `;
        checkinCreated = true;
      } else if (existingCheckins[0].status !== "checked_in" || existingCheckins[0].method !== "manual") {
        throw new Error("EXISTING_CHECKIN_MUST_NOT_BE_OVERWRITTEN");
      }

      if (responseCreated || checkinCreated) {
        await tx`
          insert into audit_logs
            (tenant_id, actor_user_id, event_id, action, target_type, target_id, after_json, reason, request_id)
          values
            (${target.tenant_id}, ${actor.id}, ${target.event_id}, 'rehearsal.seating_participant.prepare',
             'participant', ${target.participant_id},
             ${tx.json({ responseCreated, checkinCreated, answerCount: 5 })},
             'staging synthetic seating rehearsal', ${randomUUID()})
        `;
      }

      return { responseCreated, checkinCreated, answerCount: answerCounts[0]!.count };
    });
    console.info(JSON.stringify({ status: "ok", ...result }));
  } finally {
    await sql.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "REHEARSAL_SETUP_FAILED");
  process.exitCode = 1;
});
