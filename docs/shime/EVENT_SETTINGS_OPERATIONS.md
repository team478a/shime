# Event settings operations

## Access

1. Sign in at `/admin/login`.
2. Open `/admin`.
3. Select `イベントを作成`, or select `基本設定` for an existing event.

Only `manager` and `system_admin` roles can change event settings.

## Draft creation

The event code, name, start time, capacity, dream mode, and preference mode are required to create a database record. Other event-specific values may remain blank while the event is in `draft`.

The settings screen lists every missing or invalid production-required item. Dates are entered in Asia/Tokyo and stored in UTC.

## Activation gate

An event cannot move from `draft` to `accepting` while required settings are missing or a date range is invalid. State transitions move forward one step at a time. Moving backward requires a reason and manager-level permission. Changes after `result_confirmed` require `system_admin`.

The preference mode cannot be changed after preference input has opened.

## Audit

Event creation, setting changes, completeness changes, state changes, and the list of changed field names are recorded in `audit_logs`. Values that could include personal data are not written to application logs.
