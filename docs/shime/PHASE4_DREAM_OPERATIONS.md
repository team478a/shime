# Phase 4 Dream operations

- Configure each event from `/admin/events/{eventId}/dream`.
- `required_private_allowed` requires a confirmed dream but never requires public visibility.
- `optional` allows participants to skip and register later.
- Project participation is stored as a separate versioned consent and is never preselected.
- OpenAI connection is managed by a system administrator at `/admin/platform` and must also be enabled in the event Dream settings.
- Provider errors, timeouts, and invalid responses always fall back to the configured bridge template and three fixed candidates.
- AI responses are constrained with a strict JSON Schema requiring one bridge sentence and exactly three candidate strings.
- Card-set versions should not be edited after an event starts. Create a new version instead.
- Never put names, phone numbers, email addresses, or birth dates into fallback templates or future AI prompts.
