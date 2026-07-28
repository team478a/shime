# Migration 0015 staging runbook

Last updated: 2026-07-28
Target migration: `0015_strange_mandroid.sql`

## Purpose

This runbook applies the Concierge Phase 1B schema to staging without using
production data. Preflight and postflight commands are read-only and output
only migration metadata, constraint/table names, and aggregate mismatch counts.

Do not apply this migration to production under this runbook.

## Hard stop conditions

Stop without applying the migration when any of the following is true:

- PR #3 has not been approved and merged into the release branch.
- The selected project cannot be positively identified as staging.
- `DATABASE_MIGRATION_URL` is absent, points to the transaction pooler, or is
  shared with the runtime application.
- The backup timestamp and restore procedure have not been recorded.
- Preflight returns `safe: false`.
- Any preflight `scopeChecks[].count` is non-zero.
- The migration head is not `0014` (`1784935028909`) before application.

Never paste the database URL, password, participant data, or query rows into
the evidence record.

## 1. Select and verify staging

1. Check out the approved release commit and record its full SHA.
2. Confirm the Supabase project name/ref and Vercel environment are staging.
3. Set `DATABASE_MIGRATION_URL` locally to the direct connection or Session
   pooler. Do not use the Transaction pooler.
4. Run the existing environment checks:

```text
pnpm supabase:verify
pnpm supabase:backup-readiness
```

The operator must visually confirm that neither command selected production.

## 2. Create the recovery point

1. Confirm the latest Supabase scheduled backup.
2. Create the approved additional backup/export when required by the recovery
   plan.
3. Record its UTC timestamp, storage location/reference, operator, and restore
   verification status.
4. Review `docs/shime/SUPABASE_BACKUP_RECOVERY.md`.

Do not proceed merely because a backup entry exists. The team must know who can
authorize and perform recovery.

## 3. Run read-only preflight

```text
pnpm db:preflight:0015
```

Proceed only when:

- `safe` is `true`
- `migrationTimestamp` and `expectedMigrationTimestamp` are both
  `1784935028909`
- every scope check count is `0`

Any non-zero count represents a pre-existing tenant/event relationship that
the new constraints may reject. Investigate with an authorized, privacy-safe
procedure; do not modify or delete records ad hoc.

## 4. Apply migration

Keep the currently deployed staging application available for rollback, then
run:

```text
pnpm db:migrate
```

Do not deploy the Concierge UI yet. Keep diagnosis disabled until postflight
and smoke checks pass.

## 5. Run immediate postflight

```text
pnpm db:verify:0015
```

Success requires:

- `safe` is `true`
- migration timestamp is `1784965553645`
- all scope check counts remain `0`
- `missingConstraints` is empty
- `missingTables` is empty

Then run:

```text
pnpm supabase:verify
pnpm test
pnpm build
```

After the staging application is deployed, run the approved synthetic
Concierge smoke/E2E flow. Do not use real participant data.

## 6. Failure handling

If migration execution or postflight fails:

1. Stop all further migration and deployment work.
2. Preserve command output after removing secrets; do not rerun blindly.
3. Record the migration timestamp and failed/missing constraint names.
4. Keep or restore the previously deployed compatible application version.
5. Escalate to the migration owner and recovery approver.

Application rollback is preferred when the previous application remains
compatible with the expanded schema. Schema rollback must use a reviewed
forward compensating migration. Do not manually drop constraints/tables.
Restore from backup only after explicit recovery authorization and impact
assessment.

## Evidence record

```text
Environment: staging
Release commit SHA:
Operator:
Started at (UTC):
Backup reference:
Backup timestamp (UTC):
Restore procedure reviewed by:
Preflight safe:
Preflight mismatch counts:
Migration command result:
Postflight safe:
Missing constraints:
Missing tables:
Synthetic smoke result:
Completed at (UTC):
Decision / approver:
```
