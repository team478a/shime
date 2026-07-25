# CLAUDE.md - SHIME

## Project priority

SHIME is preparing for the production marriage event on **2026-08-08**.
Until the production Go decision is recorded, prioritize P0 readiness, data safety, and rehearsal completion over new features or broad refactoring.

## Read before editing

Read the following in order before planning or changing code:

1. `AGENTS.md`
2. `docs/shime/AI_HANDOFF.md`
3. `docs/shime/CODEX_CLAUDE_HANDOFF_RUNBOOK.md`
4. `docs/shime/PHASE8_READINESS_REPORT.md`
5. `docs/shime/REHEARSAL_EXECUTION_RECORD_20260715.md`
6. `docs/shime/PHASE8_REHEARSAL_CHECKLIST.md`
7. `docs/shime/DEVELOPMENT_SPEC_V2.md`
8. `docs/shime/IMPLEMENTATION_TASKS_V1.md`
9. `docs/shime/EVENT_CONFIG_20260808.yaml`
10. `docs/shime/REFACTORING_DEVELOPMENT_RULES_V1.md`

The latest explicit user instruction overrides repository documents.

## Start-of-session procedure

Before editing:

1. Run `git status --short --branch`.
2. Confirm the current branch and upstream.
3. Run `git log --oneline -10`.
4. Review commits made since the last entry in `docs/shime/AI_HANDOFF.md`.
5. Check for uncommitted changes and preserve them.
6. State the single P0 work item being handled in this session.

Do not assume Codex conversation history is available. Git history and the handoff documents are the shared source of truth.

## Production-readiness rules

- Work on one P0 item at a time.
- Do not add unrelated features while a P0 item is open.
- Do not perform a full rewrite or change stable API/DB semantics without an explicit requirement.
- Keep tenant and event scope in every data query.
- Never expose unilateral preferences, ranks, private dreams, emotion responses, or private notes to another participant.
- Do not publish seating or results before manager confirmation.
- Seating and matching must remain deterministic and rule based.
- Generative AI must have a non-AI fallback and must not block event operations.
- Never log personal data, raw CSV rows, tokens, secrets, or production participant data.
- Schema changes require migrations and a rollback or recovery note.
- On-site staff operations must remain smartphone-first.
- Production deployment, destructive data changes, or real notification sending require explicit authorization.

## Required validation

Run the relevant checks before handing work back:

```bash
pnpm format:check
pnpm architecture:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm readiness:strict
```

Run `pnpm test:e2e` when the changed behavior is covered by E2E or when completing a rehearsal gate.

If a command cannot run, record the exact reason and do not report it as passed.

## End-of-session procedure

Before stopping or handing work to Codex:

1. Re-run the relevant validation commands.
2. Update `docs/shime/AI_HANDOFF.md` with:
   - branch and latest commit
   - completed work
   - changed files
   - test commands and results
   - unresolved P0/P1/P2 items
   - exact next action
3. Update the rehearsal or readiness document when a gate was actually tested.
4. Commit with a focused message.
5. Push the current branch.
6. Do not merge to `main` without explicit approval.

## Completion report

Report:

1. What changed
2. Main files changed
3. Tests and results
4. Specification deviations
5. Remaining P0/P1/P2 items
6. Recommended next action
