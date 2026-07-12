# AGENTS.md - SHIME

## Project goal

Build the SHIME marriage-event LIFF application for the 2026-08-08 production event.

## Source of truth

Read these files before planning or editing:

- `docs/shime/CODEX_DEVELOPMENT_GUIDE_V1.md`
- `docs/shime/DEVELOPMENT_SPEC_V2.md`
- `docs/shime/IMPLEMENTATION_TASKS_V1.md`
- `docs/shime/EVENT_CONFIG_20260808.yaml`
- `docs/shime/APPLICATION_IMPORT_TEMPLATE.csv`

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

## Required checks

Before reporting completion, run the repository's relevant commands for:

- lint
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

