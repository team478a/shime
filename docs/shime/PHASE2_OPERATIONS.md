# Phase 2 operation notes

## Public applications

- Set the event to `accepting` and configure `eventTermsVersion` and `privacyVersion` before publishing `/apply/{eventId}`.
- The server rejects submissions outside the configured application window.
- Retrying the same browser submission reuses its idempotency key and does not create another application.

## CSV imports

1. Open `/admin/events/{eventId}/imports` as operator, manager, or system administrator.
2. Select the UTF-8 CSV and choose all-or-nothing or partial mode.
3. Review valid, warning, and error rows. Warnings show fields changed by re-import.
4. Commit only after reviewing the counts and row-level issues.
5. Resolve duplicate candidates as same person, different person, or on hold. The system never merges automatically.

CSV originals are stored in the private Supabase Storage bucket configured by `SUPABASE_IMPORT_BUCKET`. Do not make this bucket public.

## Fallback

If Supabase Storage is unavailable, do not bypass original-file retention. Keep the source CSV unchanged, record the incident, and retry after storage recovery.
