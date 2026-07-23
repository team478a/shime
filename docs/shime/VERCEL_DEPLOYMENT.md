# Vercel deployment

## Environment separation

- Preview is the SHIME staging environment and uses `APP_ENV=staging`.
- Production is not enabled until the event configuration, LINE/LIFF, backup restoration, and rehearsal gates pass.
- Never copy production participant data into Preview.

## Project configuration

- Vercel project root: repository root
- Framework: Next.js
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`
- Output directory: `apps/web/.next`

The project must stay rooted at the repository root because the web application imports workspace packages from `packages/`.

Use the Supabase Transaction Pooler on port 6543 for `DATABASE_URL`. Keep the direct database connection on port 5432 only in the local/CI `DATABASE_MIGRATION_URL`; do not add the migration connection to the Vercel runtime.

## Required server environment variables

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_IMPORT_BUCKET`
- `SUPABASE_CONCIERGE_BUCKET`（Conciergeカード画像用の非公開bucket）
- `SESSION_PEPPER`
- `PASSWORD_PEPPER`
- `LINK_TOKEN_PEPPER`
- `QR_TOKEN_PEPPER`
- `INTERNAL_JOB_SECRET`
- `APP_URL`
- `APP_ENV`

LINE/LIFF variables are required before LINE integration testing:

- `LINE_CHANNEL_ID`
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `NEXT_PUBLIC_LIFF_ID`

Seed-only variables must not be added to the Vercel runtime:

- `DATABASE_MIGRATION_URL`
- `SEED_ADMIN_PASSWORD`
- `SEED_DEMO_PARTICIPANTS`

## Release gates

1. Run lint, typecheck, unit tests, integration tests, and production build.
2. Apply database migrations separately before deployment.
3. Deploy to Preview and verify `/`, `/admin/login`, and unauthenticated API rejection.
4. Set `APP_URL` to the stable staging URL and redeploy.
5. Connect LINE/LIFF and run authenticated mobile-device tests.
6. Promote to Production only after the Phase 8 P0 gates are complete.

## Notification job

The notification route requires `Authorization: Bearer <INTERNAL_JOB_SECRET>`. Do not enable a scheduled caller until its secret handling, retry behavior, Vercel plan limits, and LINE credentials have been verified in staging.
