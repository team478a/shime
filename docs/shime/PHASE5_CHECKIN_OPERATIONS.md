# Phase 5 Passport and check-in operations

- Participant Passport: `/liff/passport?eventId={eventId}`.
- Staff reception: `/admin/events/{eventId}/checkin`.
- A QR contains only `SHIME1:` plus an opaque random token. It contains no name, contact details, participant number, or Dream No.
- Showing a new QR invalidates the previous QR. QR tokens expire after 24 hours.
- Camera scanning requires HTTPS and camera permission. Scanner text input and manual verification remain available as fallback.
- Participant QR is rendered at 480 px with a larger quiet zone. The participant can also open it separately, save the image, or copy the opaque reception code.
- If the QR cannot be displayed, staff search by a participant-number prefix or part of the participant name, select a candidate, and confirm check-in. Phone numbers are not needed or shown in search results.
- On the same smartphone, LINE identity linking does not require scanning a QR. Use the direct LINE button or copy the one-time linking URL.
- Scanning or searching only displays a confirmation preview. Staff must press the separate confirmation button to check in.
- Duplicate check-in returns a warning and never creates another history record.
- Cancellation uses a reason preset (`参加者都合`, `受付操作の訂正`, `重複受付の修正`, or `その他`) plus an optional note. `その他` requires a note. It retains both `checkin_logs` and `audit_logs`.
- On smartphones, manual-search results and participant-link records are displayed as cards with full-width primary actions instead of a horizontally scrolling table.
- The participant-link list supports the same participant-number prefix and partial-name search plus linked/unlinked filtering.
- Manual search shows `検索中`, match count, no-match guidance, permission failure, communication failure, and expired-session guidance immediately below the search button. An expired session provides a direct re-login action.
- Participant-number prefixes and digit count come from event configuration; they are not hardcoded.
