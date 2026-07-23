import "dotenv/config";

import postgres from "postgres";
import { z } from "zod";

const eventCodeSchema = z.string().regex(/^rh-[a-z]-\d{8}$/);

async function main() {
  if (process.env.APP_ENV !== "staging") throw new Error("STAGING_ONLY");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");
  const eventCode = eventCodeSchema.parse(process.argv[2] ?? "rh-a-20260715");
  const tenantCode = process.env.BOOTSTRAP_TENANT_CODE ?? "shime";
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });

  try {
    const rows = await sql<
      {
        status: string;
        assignments: number;
        assigned: number;
        locked: number;
        a01_locked: number;
      }[]
    >`
      select sr.status,
        count(sa.id)::int as assignments,
        count(sa.seat_id)::int as assigned,
        count(*) filter (where sa.locked)::int as locked,
        count(*) filter (where p.participant_number = 'A01' and sa.locked)::int as a01_locked
      from seating_runs sr
      join events e on e.id = sr.event_id and e.tenant_id = sr.tenant_id
      join tenants t on t.id = sr.tenant_id
      left join seat_assignments sa
        on sa.seating_run_id = sr.id and sa.tenant_id = sr.tenant_id and sa.event_id = sr.event_id
      left join participants p
        on p.id = sa.participant_id and p.tenant_id = sr.tenant_id and p.event_id = sr.event_id
      where t.code = ${tenantCode} and e.code = ${eventCode}
        and sr.created_at = (
          select max(latest.created_at)
          from seating_runs latest
          where latest.tenant_id = sr.tenant_id and latest.event_id = sr.event_id
        )
      group by sr.id, sr.status
      limit 1
    `;
    const latest = rows[0];
    if (!latest) throw new Error("SEATING_DRAFT_NOT_FOUND");
    if (latest.status !== "draft" || latest.assignments !== 2 || latest.assigned !== 2 || latest.a01_locked !== 1) {
      throw new Error("LATEST_SEATING_DRAFT_NOT_EXPECTED");
    }
    console.info(
      JSON.stringify({
        status: "ok",
        runStatus: latest.status,
        assignments: latest.assignments,
        assigned: latest.assigned,
        locked: latest.locked,
        a01Locked: latest.a01_locked,
      }),
    );
  } finally {
    await sql.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "SEATING_DRAFT_VERIFICATION_FAILED");
  process.exitCode = 1;
});
