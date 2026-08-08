import postgres from "postgres";

export type Migration0015Phase = "preflight" | "postflight";

export const MIGRATION_0015_PREVIOUS_TIMESTAMP = "1784935028909";
export const MIGRATION_0015_TIMESTAMP = "1784965553645";

export const MIGRATION_0015_SCOPE_CHECKS = [
  {
    key: "applications_event_scope",
    query: `
      select count(*)::int as count
      from applications child
      left join events parent
        on parent.tenant_id = child.tenant_id and parent.id = child.event_id
      where parent.id is null
    `,
  },
  {
    key: "participants_event_scope",
    query: `
      select count(*)::int as count
      from participants child
      left join events parent
        on parent.tenant_id = child.tenant_id and parent.id = child.event_id
      where parent.id is null
    `,
  },
  {
    key: "participants_application_scope",
    query: `
      select count(*)::int as count
      from participants child
      left join applications parent
        on parent.tenant_id = child.tenant_id
        and parent.event_id = child.event_id
        and parent.id = child.application_id
      where parent.id is null
    `,
  },
  {
    key: "participants_user_scope",
    query: `
      select count(*)::int as count
      from participants child
      left join users parent
        on parent.tenant_id = child.tenant_id and parent.id = child.user_id
      where child.user_id is not null and parent.id is null
    `,
  },
  {
    key: "participant_sessions_user_scope",
    query: `
      select count(*)::int as count
      from participant_sessions child
      left join users parent
        on parent.tenant_id = child.tenant_id and parent.id = child.user_id
      where parent.id is null
    `,
  },
  {
    key: "concierge_templates_creator_scope",
    query: `
      select count(*)::int as count
      from concierge_templates child
      left join users parent
        on parent.tenant_id = child.tenant_id and parent.id = child.created_by
      where parent.id is null
    `,
  },
  {
    key: "concierge_template_versions_template_scope",
    query: `
      select count(*)::int as count
      from concierge_template_versions child
      left join concierge_templates parent
        on parent.tenant_id = child.tenant_id and parent.id = child.template_id
      where parent.id is null
    `,
  },
  {
    key: "concierge_template_versions_creator_scope",
    query: `
      select count(*)::int as count
      from concierge_template_versions child
      left join users parent
        on parent.tenant_id = child.tenant_id and parent.id = child.created_by
      where parent.id is null
    `,
  },
  {
    key: "event_concierge_snapshots_event_scope",
    query: `
      select count(*)::int as count
      from event_concierge_snapshots child
      left join events parent
        on parent.tenant_id = child.tenant_id and parent.id = child.event_id
      where parent.id is null
    `,
  },
  {
    key: "event_concierge_snapshots_template_version_scope",
    query: `
      select count(*)::int as count
      from event_concierge_snapshots child
      left join concierge_template_versions parent
        on parent.tenant_id = child.tenant_id
        and parent.id = child.template_version_id
        and parent.version = child.template_version
      where parent.id is null
    `,
  },
  {
    key: "event_concierge_snapshots_applier_scope",
    query: `
      select count(*)::int as count
      from event_concierge_snapshots child
      left join users parent
        on parent.tenant_id = child.tenant_id and parent.id = child.applied_by
      where parent.id is null
    `,
  },
] as const;

export const MIGRATION_0015_EXPECTED_CONSTRAINTS = [
  { table: "applications", name: "applications_tenant_event_id_uidx", type: "u" },
  { table: "applications", name: "applications_event_scope_fk", type: "f" },
  { table: "events", name: "events_tenant_id_uidx", type: "u" },
  { table: "participants", name: "participants_tenant_event_id_uidx", type: "u" },
  { table: "participants", name: "participants_event_scope_fk", type: "f" },
  { table: "participants", name: "participants_application_scope_fk", type: "f" },
  { table: "participants", name: "participants_user_scope_fk", type: "f" },
  { table: "participant_sessions", name: "participant_sessions_user_scope_fk", type: "f" },
  { table: "users", name: "users_tenant_scope_uidx", type: "u" },
  { table: "concierge_templates", name: "concierge_templates_tenant_id_uidx", type: "u" },
  { table: "concierge_templates", name: "concierge_templates_creator_scope_fk", type: "f" },
  {
    table: "concierge_template_versions",
    name: "concierge_template_versions_tenant_id_version_uidx",
    type: "u",
  },
  {
    table: "concierge_template_versions",
    name: "concierge_template_versions_template_scope_fk",
    type: "f",
  },
  {
    table: "concierge_template_versions",
    name: "concierge_template_versions_creator_scope_fk",
    type: "f",
  },
  {
    table: "event_concierge_snapshots",
    name: "event_concierge_snapshots_tenant_event_id_uidx",
    type: "u",
  },
  {
    table: "event_concierge_snapshots",
    name: "event_concierge_snapshots_event_scope_fk",
    type: "f",
  },
  {
    table: "event_concierge_snapshots",
    name: "event_concierge_snapshots_template_version_scope_fk",
    type: "f",
  },
  {
    table: "event_concierge_snapshots",
    name: "event_concierge_snapshots_applier_scope_fk",
    type: "f",
  },
  {
    table: "concierge_card_asset_versions",
    name: "concierge_card_asset_versions_tenant_id_uidx",
    type: "u",
  },
  { table: "concierge_sessions", name: "concierge_sessions_tenant_event_id_uidx", type: "u" },
  { table: "concierge_sessions", name: "concierge_sessions_participant_scope_fk", type: "f" },
  { table: "concierge_sessions", name: "concierge_sessions_snapshot_scope_fk", type: "f" },
  { table: "concierge_sessions", name: "concierge_sessions_selected_card_tenant_fk", type: "f" },
  { table: "concierge_answers", name: "concierge_answers_session_scope_fk", type: "f" },
  {
    table: "concierge_answer_revisions",
    name: "concierge_answer_revisions_session_scope_fk",
    type: "f",
  },
  { table: "concierge_rule_results", name: "concierge_rule_results_session_scope_fk", type: "f" },
  {
    table: "concierge_access_logs",
    name: "concierge_access_logs_participant_scope_fk",
    type: "f",
  },
  { table: "concierge_access_logs", name: "concierge_access_logs_session_scope_fk", type: "f" },
  { table: "concierge_access_logs", name: "concierge_access_logs_viewer_tenant_fk", type: "f" },
] as const;

export const MIGRATION_0015_EXPECTED_TABLES = [
  "concierge_access_logs",
  "concierge_answer_revisions",
  "concierge_answers",
  "concierge_rule_results",
  "concierge_sessions",
] as const;

export const MIGRATION_0015_CONSTRAINT_QUERY = `
  select constraint_record.conname,
         relation.relname as table_name,
         constraint_record.contype::text as constraint_type
  from pg_constraint constraint_record
  join pg_class relation on relation.oid = constraint_record.conrelid
  join pg_namespace namespace_record on namespace_record.oid = relation.relnamespace
  where namespace_record.nspname = 'public'
`;

type ScopeCheckResult = {
  key: (typeof MIGRATION_0015_SCOPE_CHECKS)[number]["key"];
  count: number;
};

export type Migration0015Readiness = {
  phase: Migration0015Phase;
  safe: boolean;
  readOnly: boolean;
  migrationTimestamp: string | null;
  expectedMigrationTimestamp: string;
  scopeChecks: ScopeCheckResult[];
  missingScopeChecks: ScopeCheckResult["key"][];
  missingConstraints: string[];
  missingTables: string[];
};

const expectedScopeCheckKeys = new Set(MIGRATION_0015_SCOPE_CHECKS.map((check) => check.key));

export function evaluateMigration0015Readiness(
  input: Omit<Migration0015Readiness, "safe" | "missingScopeChecks">,
): Migration0015Readiness {
  const actualScopeCheckKeys = new Set(input.scopeChecks.map((check) => check.key));
  const missingScopeChecks = [...expectedScopeCheckKeys].filter((key) => !actualScopeCheckKeys.has(key));
  const hasDuplicateScopeChecks = actualScopeCheckKeys.size !== input.scopeChecks.length;
  return {
    ...input,
    missingScopeChecks,
    safe:
      input.readOnly &&
      input.migrationTimestamp === input.expectedMigrationTimestamp &&
      !hasDuplicateScopeChecks &&
      input.scopeChecks.length === expectedScopeCheckKeys.size &&
      missingScopeChecks.length === 0 &&
      input.scopeChecks.every((check) => check.count === 0) &&
      input.missingConstraints.length === 0 &&
      input.missingTables.length === 0,
  };
}

export async function collectMigration0015Readiness(
  databaseUrl: string,
  phase: Migration0015Phase,
): Promise<Migration0015Readiness> {
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    await sql.unsafe("set default_transaction_read_only = on");
    await sql.unsafe("set statement_timeout = '30s'");
    const readOnlyRows = await sql.unsafe<{ read_only: boolean }[]>(
      "select current_setting('transaction_read_only') = 'on' as read_only",
    );

    const migrationRows = await sql.unsafe<{ migration_timestamp: string | null }[]>(
      "select max(created_at)::text as migration_timestamp from drizzle.__drizzle_migrations",
    );
    const scopeChecks: ScopeCheckResult[] = [];
    for (const check of MIGRATION_0015_SCOPE_CHECKS) {
      const rows = await sql.unsafe<{ count: number }[]>(check.query);
      scopeChecks.push({ key: check.key, count: rows[0]?.count ?? -1 });
    }

    const expectedMigrationTimestamp =
      phase === "preflight" ? MIGRATION_0015_PREVIOUS_TIMESTAMP : MIGRATION_0015_TIMESTAMP;
    let missingConstraints: string[] = [];
    let missingTables: string[] = [];
    if (phase === "postflight") {
      const constraintRows = await sql.unsafe<{ conname: string; table_name: string; constraint_type: string }[]>(
        MIGRATION_0015_CONSTRAINT_QUERY,
      );
      const existingConstraints = new Set(
        constraintRows.map((row) => `${row.table_name}:${row.conname}:${row.constraint_type}`),
      );
      missingConstraints = MIGRATION_0015_EXPECTED_CONSTRAINTS.filter(
        (constraint) => !existingConstraints.has(`${constraint.table}:${constraint.name}:${constraint.type}`),
      ).map((constraint) => `${constraint.table}.${constraint.name}`);

      const tableRows = await sql.unsafe<{ table_name: string }[]>(
        "select table_name from information_schema.tables where table_schema = 'public'",
      );
      const existingTables = new Set(tableRows.map((row) => row.table_name));
      missingTables = MIGRATION_0015_EXPECTED_TABLES.filter((table) => !existingTables.has(table));
    }

    return evaluateMigration0015Readiness({
      phase,
      readOnly: readOnlyRows[0]?.read_only ?? false,
      migrationTimestamp: migrationRows[0]?.migration_timestamp ?? null,
      expectedMigrationTimestamp,
      scopeChecks,
      missingConstraints,
      missingTables,
    });
  } finally {
    await sql.end();
  }
}
