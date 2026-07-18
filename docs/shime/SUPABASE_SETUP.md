# Supabase database setup

SHIME uses Supabase as managed PostgreSQL. Authentication remains SHIME's own staff ID/password authentication; Supabase Auth and the browser Data API are not used in Phase 1.

## 1. Create projects

Create separate Supabase projects for `staging` and `production`. Do not copy production participant data into staging.

## 2. Configure connection strings

Copy connection strings from Supabase Dashboard → Connect.

- `DATABASE_URL`: Transaction pooler connection, normally port `6543`. Use this for the Vercel/Next.js runtime. Keep `sslmode=require`.
- `DATABASE_MIGRATION_URL`: Direct connection, or the Session pooler on port `5432` when direct IPv6 connectivity is unavailable. Use this only for migration and seed commands.

Do not expose either value through a `NEXT_PUBLIC_` variable. Do not use the Supabase service-role key as a database password.

## 3. Apply Phase 1 schema

```powershell
pnpm db:migrate
pnpm db:seed
```

`SEED_ADMIN_PASSWORD` must be a unique development or staging password. Do not run the sample staff seed against production without replacing the seed identities and reviewing the event configuration.

## 4. Vercel settings

Set `DATABASE_URL` independently for Preview and Production. Set `DATABASE_MIGRATION_URL` only in the controlled migration environment; the deployed web runtime does not need it.

## 5. Backups and recovery

Enable the Supabase backup/PITR option appropriate to the production plan. Before the event, perform a documented restore rehearsal into a non-production project and verify the restored migration version and row counts.

Run `pnpm supabase:backup-readiness` for the non-destructive preflight and follow [SUPABASE_BACKUP_RECOVERY.md](./SUPABASE_BACKUP_RECOVERY.md). Database backups do not contain the Storage object bodies, so back up the private import bucket separately.
