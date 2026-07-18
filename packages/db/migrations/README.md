# Database migrations

- Generate migrations with `pnpm db:generate` and commit both SQL and metadata.
- Apply migrations with `pnpm db:migrate` against an explicitly selected environment. On Supabase, set `DATABASE_MIGRATION_URL` to a direct connection or Session pooler; do not run DDL through the Transaction pooler.
- Production migrations are forward-only. Never edit a migration already applied outside local development.
- Roll back application code first when compatible. For schema rollback, create a new compensating migration.
- Destructive changes use expand/migrate/contract: add the replacement, backfill and verify, then remove the old shape in a later release.
- Back up production and verify recovery before event-week schema changes.
