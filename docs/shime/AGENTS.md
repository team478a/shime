# AGENTS.md - SHIME

## Project goal

Build the SHIME marriage-event LIFF application for the 2026-08-08 production event.

## Source of truth

Read these files before planning or editing:

- `docs/shime/SHIME_Codex開発開始指示書_v1.0.md`
- `docs/shime/SHIME_婚活イベント_開発仕様書_v2.0.md`
- `docs/shime/SHIME_婚活イベント_開発実装指示書_v1.0.md`
- `docs/shime/SHIME_20260808_イベント設定テンプレート.yaml`
- `docs/shime/SHIME_参加申込_CSV取込テンプレート.csv`

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

