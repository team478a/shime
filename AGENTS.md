# AGENTS.md - SHIME

## Project goal

Build the SHIME marriage-event LIFF application for the 2026-08-08 production event while treating SHIME as an extensible operations OS that can support multiple services, event types, and combined workflows.

## Source of truth

Read these files before planning or editing:

- `docs/shime/CODEX_DEVELOPMENT_GUIDE_V1.md`
- `docs/shime/DEVELOPMENT_SPEC_V2.md`
- `docs/shime/IMPLEMENTATION_TASKS_V1.md`
- `docs/shime/EVENT_CONFIG_20260808.yaml`
- `docs/shime/APPLICATION_IMPORT_TEMPLATE.csv`
- `docs/shime/PLATFORM_OS_PRINCIPLES.md`
- `docs/shime/REFACTORING_MASTER_PLAN_V1.md`
- `docs/shime/REFACTORING_DEVELOPMENT_RULES_V1.md`

Latest explicit user instructions override these documents.

## Implementation rules

- Work one phase at a time.
- Preserve all existing user changes.
- Do not hardcode event-specific values.
- Keep tenant and event boundaries in every data query.
- Never log PII, secrets, LINE tokens, or raw CSV rows.
- Never expose unilateral preferences, ranks, private dreams, or emotion answers to another participant.
- Do not publish seating or results before manager confirmation.
- Seating and mutual-preference detection must be deterministic rule-based logic.
- Generative AI may draft text only and must always have a non-AI fallback.
- Keep LINE, AI, and storage providers behind interfaces so tests can use fakes.
- Store timestamps in UTC and display in Asia/Tokyo.
- Use migrations for every schema change.
- Add tests with every behavior change.
- Treat on-site staff operations as smartphone-first; do not assume a PC is available.
- Minimize staff typing by reusing known data, short prefix/partial searches, candidate selection, presets, and context-preserving navigation.
- Keep touch targets large and keep the primary action usable without horizontal scrolling.
- Input reduction must not weaken tenant/event isolation, permissions, explicit confirmation for consequential actions, or audit logging.
- Build reusable platform capabilities separately from service-specific modules; do not embed marriage-event assumptions in shared authentication, permissions, forms, notifications, jobs, storage, or integration layers.
- Model reusable templates separately from event instances. Copy a versioned snapshot into an event so later template edits cannot alter historical or in-progress operations.
- Prefer module contracts, provider interfaces, and versioned configuration over direct cross-module table coupling.
- Keep tenant, service/module, and event scopes explicit so future horizontal expansion does not leak data or permissions across boundaries.
- Refactor incrementally as a modular monolith; never perform a full rewrite or change UI, API contracts, or database semantics as part of a refactor.
- Keep one refactoring phase and one business module per change. Cross-cutting Phase 0 tooling changes are the only exception.
- New or migrated API routes handle HTTP concerns only and call use cases. Do not add new direct Drizzle access to route files.
- Use cases must not depend on HTTP, UI, or Drizzle. They depend on repository interfaces.
- Only repository implementations may use Drizzle for migrated modules.
- New or migrated Client Components use module hooks instead of calling API endpoints directly.
- Every `Record<string, unknown>` configuration introduced or touched must have an explicit Zod schema at its boundary.
- Do not increase the architecture debt baselines enforced by `pnpm architecture:check`; lower them when a legacy dependency is removed.

## Required checks

Before reporting completion, run the repository's relevant commands for:

- lint
- format check
- architecture check
- typecheck
- unit tests
- integration tests
- production build

Report commands that could not run and the reason.

## Safety boundaries

- Never commit `.env` files or credentials.
- Never copy production personal data into development or test fixtures.
- Never use destructive git commands unless explicitly authorized.
- Never overwrite check-in, preference, or result data during CSV re-import.

## Completion report

Report:

1. What changed
2. Main files changed
3. Tests and results
4. Deviations from specification
5. Remaining P0/P1/P2 items
6. Recommended next phase
