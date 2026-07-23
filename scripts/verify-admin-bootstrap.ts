import "dotenv/config";

import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_MIGRATION_URL or DATABASE_URL is required");
  const tenantCode = process.env.BOOTSTRAP_TENANT_CODE ?? "shime";
  const loginId = (process.env.BOOTSTRAP_ADMIN_LOGIN_ID ?? "admin").toLowerCase();
  const sql = postgres(databaseUrl, { prepare: false, max: 1 });

  try {
    const [result] = await sql<
      {
        tenant_count: number;
        admin_identity_count: number;
        credential_count: number;
        system_admin_role_count: number;
        event_count: number;
      }[]
    >`
      select
        count(distinct t.id)::int as tenant_count,
        count(distinct ui.id)::int as admin_identity_count,
        count(distinct pc.user_id)::int as credential_count,
        count(distinct sr.id)::int as system_admin_role_count,
        count(distinct e.id)::int as event_count
      from tenants t
      left join user_identities ui
        on ui.tenant_id = t.id
        and ui.provider = 'password'
        and ui.provider_user_id = ${loginId}
      left join password_credentials pc
        on pc.tenant_id = t.id
        and pc.user_id = ui.user_id
      left join staff_roles sr
        on sr.tenant_id = t.id
        and sr.user_id = ui.user_id
        and sr.role = 'system_admin'
        and sr.event_id is null
      left join events e on e.tenant_id = t.id
      where t.code = ${tenantCode}
    `;

    console.info(
      JSON.stringify({
        connection: "ok",
        tenantExists: result?.tenant_count === 1,
        adminIdentityCount: result?.admin_identity_count ?? 0,
        credentialCount: result?.credential_count ?? 0,
        systemAdminRoleCount: result?.system_admin_role_count ?? 0,
        eventCount: result?.event_count ?? 0,
      }),
    );
  } finally {
    await sql.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Administrator verification failed");
  process.exitCode = 1;
});
