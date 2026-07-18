# Phase 3 LINE setup

## 本人連携リンクの再発行

- 管理トップから対象イベントの「参加者・LINE連携」を開く。
- 未連携参加者の「リンクを再発行」を押す。旧URLは即時失効する。
- 新URLは72時間有効で、応答画面に一度だけ表示される。閉じる前にLINEで開くかコピーする。
- URLと生トークンはDBと監査ログに保存しない。DBにはハッシュと有効期限のみ保存する。
- 操作するスマートフォンのLINEアカウントが対象参加者本人であることを確認する。
- 連携済み参加者のリンクは再発行できない。

## Configuration source

The system administrator can save LINE Login Channel ID, LIFF ID, Messaging API Channel Secret, and Channel Access Token from `/admin/platform`. Secret values are encrypted and are never displayed again.

The page also displays the complete LIFF launch URL, LIFF Endpoint URL, and tenant-scoped Messaging API Webhook URL to copy into LINE Developers. A saved LIFF ID is read at request time for the application and identity-link screens; a Vercel rebuild is not required.

## Server variable fallbacks

- `LINE_CHANNEL_ID`: LINE Login channel ID used to verify LIFF ID tokens.
- `LINE_CHANNEL_SECRET`: Messaging API channel secret used only for webhook signature verification.
- `LINE_CHANNEL_ACCESS_TOKEN`: Messaging API channel access token used only by the server notification worker.
- `NEXT_PUBLIC_LIFF_ID`: optional fallback when no tenant LIFF ID is saved. The LIFF ID itself is public, but secrets must never use a `NEXT_PUBLIC_` prefix.
- `LINK_TOKEN_PEPPER`: independent random secret for hashing application-link tokens.
- `INTERNAL_JOB_SECRET`: bearer secret for `/api/jobs/notifications`.

Do not paste secrets into chat, commit them, or prefix them with `NEXT_PUBLIC_`.

## LINE Console configuration

1. Copy the displayed LIFF Endpoint URL from `/admin/platform` into the LIFF app.
2. Copy the displayed tenant-scoped Webhook URL into the Messaging API channel.
3. Enable webhook delivery only after the production URL uses HTTPS.
4. Use the LINE Console verification action and confirm invalid signatures return 401.

## Local verification

Unit tests use `FakeLineProvider`; no real LINE account or token is required. Real ID tokens are always sent raw to the server and verified by LINE. The browser never submits decoded profile claims as verified identity.

## Notification worker

Call `POST /api/jobs/notifications` from a protected scheduler with `Authorization: Bearer <INTERNAL_JOB_SECRET>`. Failed messages retain attempts and can be returned to `queued` through the administrator retry API.

## Staging verification record

2026-07-14:

- Registered all four LINE/LIFF variables as Sensitive values in the Vercel `shime-staging` Production environment.
- Redeployed and confirmed that `NEXT_PUBLIC_LIFF_ID` is present in the deployed LIFF client bundle.
- Confirmed a correctly signed empty LINE Webhook request returns 200 and an invalid signature returns 401.
- Replaced `LINE_CHANNEL_ACCESS_TOKEN`, redeployed staging, and confirmed the current token returns 200 from the LINE Bot Info API.
- No LINE notification was sent and no participant data was created during this check.
- Updated the participant application and identity-link screens to read the tenant LIFF ID saved by the administrator instead of relying only on a build-time environment variable.
- Added the exact LIFF launch, Endpoint, and tenant-scoped Webhook URLs to the administration page.
- Deployed the runtime-managed LIFF configuration to staging (`dpl_GL5jjSg2Ctw7c1Cbs4wdXoNkyZWp`). Confirmed authenticated platform configuration and LINE connection checks return 200, the LIFF link route returns 200, a signed empty webhook returns 200, an invalid signature returns 401, and a request without tenant scope returns 400.
- Registered the tenant-scoped staging Webhook URL in the SHIME Messaging API channel.
- Created a separate `SHIME Login` LINE Login channel in the same SHIME provider, with Japan as the service and operator region and Web App enabled.
- Linked the existing SHIME Official Account to the LINE Login channel.
- Created the SHIME LIFF app with full size, `openid` scope, the staging `/liff/link` Endpoint URL, and normal friend-add flow.
- Saved the LINE Login channel ID and LIFF ID through `/admin/platform`; LINE connection and generated public URLs were rechecked successfully.
- Remaining manual verification: open the LIFF URL in the LINE mobile app, add the SHIME Official Account, complete ID-token login, and exercise identity linking with a disposable test application. Do not use production participant data.
- Added support for LINE's primary redirect `liff.state` as well as the secondary redirect's direct query parameters, and deployed it to staging (`dpl_DkNth5zoHtivgQykKRUrQFypdy92`).
- Created one isolated staging rehearsal event and one synthetic application for real-device linking. The link is distributed only as a 72-hour QR code; its bearer token is not written to logs or documentation.
