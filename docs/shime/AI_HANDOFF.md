# SHIME AI引継ぎ記録

## 現在の状態（唯一の最新状態。これ以外の記述は本セクションで上書きされる過去の記録）

最終更新: 2026-07-31 15:40（Asia/Tokyo、Codex。クライアントUATガイド公開）
作業ブランチ: `release/2026-08-08-readiness`
deployment source HEAD: `cb53da7fd4a1f43930b69fe892de1c95d3c05739`
PR #3最終HEAD: `3fb7c64b0bb1e99bf745242b67ddf39fcdcf08c0`
release merge commit: `cef5ace36768b2af82e4dc47cdf91d250d9fbdc5`
PR #4 merge commit: `a40e0a64cab3b084ec8cd787bbc3831bc0ded940`
最新文書コミット: 本更新を含むコミット（コミット自身のSHAは文書内へ自己参照しない）
開始時の `main`: `b07d1ce`

### クライアントUATガイド公開（2026-07-31）

- `docs/shime/CLIENT_UAT_GUIDE_20260731.md`へ、参加者・スタッフ双方の画面確認、
  現在の基準フロー、フロー確定回答、正式イベント情報15項目、問題報告様式、
  P0/P1/P2判定、8月7日までの確認日程、承認記録を整理した。
- 実データを使わずUAT専用イベントと合成参加者だけを使用する安全条件を明記した。
- 管理者認証必須のWeb版`/admin/manual/uat`と、スマートフォン保存用Markdownを追加した。
- 公開マニュアル一覧`/manual`と管理者用ナビゲーションからアクセスできる。
- architecture、lint、typecheck、単体312件、結合37件、production buildに成功した。
  マニュアルE2Eは7件成功・デスクトップ対象外1件skip。
- commit `cb53da7fd4a1f43930b69fe892de1c95d3c05739`をreleaseへpushし、
  production deployment `dpl_8z5wUqKYGsQMmpRuHt2qSWMT8ysr`へ反映した。
- 公開後、`/manual` 200、UATガイド表示、Markdown download 200、
  未認証`/admin/manual/uat`のlogin redirect 307、health 200を確認した。
- 次はクライアントがUATガイドに沿って初回確認を行い、導線と15項目を回答する。
- **本番Go判定ではない。**

### production隔離UAT・参加者PASS席表示（2026-07-31）

- 独自ドメイン`https://app.shimelife.jp`で、UAT専用tenant・イベント・合成参加者だけを使用した。
- LINE/LIFF、本人連携、Dream、席案内5問、PASS、QR、手動受付、席配置・公開までを実機確認した。
- カテゴリが片側1名だけのときは`CATEGORY_PAIR_CONFLICT`で不正な席保存を防止し、
  異なるカテゴリ2名では配置・ロック・保存・公開まで完了した。
- UAT中、公開済み席がSHIME PASSへ表示されない不足を発見した。
- 参加者本人の公開済み席だけを返すRepository / UseCaseへAPIを分離し、PASSに
  テーブル・席番号、準備中表示、更新操作を追加した。
- 単体312件・結合37件、architecture、lint、typecheck、buildに成功した。
  新規E2Eはモバイル・デスクトップ4件成功。全E2Eは37件成功・4件skipで、
  既存マニュアル1件が並列実行時だけ失敗したが単独再実行3件は成功した。
- commit `67fc36e8383ad449c116dfcd32ae336d9d39399a`をreleaseへpushし、
  production deployment `dpl_3oxmU4iWmJ4VpsBjdDDwRYYip2s9`へ反映した。
- deployment `READY`、独自ドメインalias、health 200、未認証席API 401を確認した。
- 修正後のスマートフォンでA01に`T01 / T01-1`が表示される最終確認が次の操作。
- 詳細: `docs/shime/PRODUCTION_UAT_EXECUTION_20260731.md`
- **本番Go判定ではない。**

### 管理者・参加者マニュアル整備（2026-07-31）

- `docs/shime/ADMINISTRATOR_MANUAL.md`へ、権限、初期設定、申込・CSV、LINE連携、
  当日受付、席配置、希望・結果、通知、CSV、障害対応、本番前チェックを統合した。
- `docs/shime/PARTICIPANT_MANUAL.md`へ、申込、LINE本人連携、Dream、席案内5問、
  SHIME診断、PASS・受付QR、席、希望、結果、トラブル対応、プライバシーを統合した。
- `docs/shime/MANUAL_INDEX.md`に対象範囲と配布時の注意を記録した。
- 管理トップの「運用資料をダウンロード」へ管理者用・参加者用の2冊を追加し、
  `pnpm docs:sync`でスマートフォンから取得できる公開ファイルを生成する設定とした。
- Web版として、公開一覧`/manual`、参加者用`/manual/participant`、認証必須の
  管理者用`/admin/manual`を追加した。Markdown正本から静的・安全なReact要素へ変換し、
  目次、章内リンク、表、チェックリスト、Markdown保存、印刷、モバイル表示に対応した。
- 管理画面の全スタッフ共通メニューへ「操作マニュアル」を追加した。
- Love Passport公開プロフィールは未実装のため操作対象に含めず、決済は2026-08-08の
  必須導線に含めないことを明記した。
- 検証: 変更ファイルPrettier、architecture、lint、typecheck、単体307件、
  結合37件、production buildに成功した。WebマニュアルE2Eはモバイル・デスクトップで
  5件成功、デスクトップ対象外1件skip。管理者用の未認証アクセスがloginへ戻ること、
  参加者用に横スクロールがないことを確認した。
- commit `c991fbf170da4a636bb617a50805e8c62ecff9ea`を
  `release/2026-08-08-readiness`へpushし、productionへデプロイした。
- productionの`APP_URL`を`https://app.shimelife.jp`へ更新し、Vercelの独自ドメイン、
  SSL、`/api/health` 200を確認した。
- 公開後確認: `/manual` 200、`/manual/participant` 200、未認証の`/admin/manual`は
  `/admin/login`へ307、管理者用・参加者用Markdownダウンロードはいずれも200。
- 本番Go判定と既存P0の状態は変更しない。

### production基盤 初期反映（2026-07-30 17:50）

- 利用者の明示承認に基づき、新規production Supabase
  `dipcpqmbmumazyuorslv`のDashboard physical backupを確認した。
- 本番DBは新規空DBだったため、migration 0000〜0015の全16件を初期適用した。
- postflightはmigration head 0015、scope不整合11件すべて0、欠落制約・テーブル0、
  `safe: true`。runtime/migration接続が同一DBであることも確認した。
- private Storage bucket `shime-private-imports`と`shime-private-concierge`を作成した。
- 独立Vercel project `shime-production`を作成し、release HEAD
  `859da688`を`https://shime-production.vercel.app`へproduction deployした。
- Vercel runtimeのdirect DB hostnameによる`ENOTFOUND`を検出し、検証済み東京Transaction
  Pooler 6543へ変更した。current deployment IDは`dpl_GgVDH4MntkqCuRjcFjDZDHWL2na7`、stateはREADY。
- health 200、未認証管理画面のlogin redirect、production画面にstaging警告がないことを確認した。
- 単体304件、結合37件、E2E 29件（3件skip）、architecture、lint、typecheck、
  build、dependency auditに成功した。
- 隔離tenant `shime-uat`、管理者`uat-admin`、UAT event `uat-client-20260730`を作成した。
  eventは設定完全、status `accepting`、20席、Dream 8カード（AI無効）、5問、
  UAT専用仮規約2件、合成申込・参加者各1件。他tenant eventは0件。
- 管理者パスワード、pepper、本人連携tokenはログ・文書・Gitへ記録していない。
- LINE/LIFF、OpenAIは本番未設定。本番LINE導線の端末UATは未実施。
- REQUIRED_INPUT 15件、復旧リハーサル、全導線UAT、監視・定期ジョブ確認が残るため、
  **本番Go判定ではない**。
- 詳細: `docs/shime/PRODUCTION_FOUNDATION_ROLLOUT_20260730.md`

### Concierge Phase 1B staging実機確認準備（2026-07-28 19:30）

- staging DBの読み取り専用確認で、Concierge card、template、event snapshot、sessionがすべて0件であることを確認した。
- `scripts/setup-concierge-rehearsal.ts`を追加した。`APP_ENV=staging`、RH形式イベント、
  draft/accepting、診断OFF、private Storageを強制し、既定は読み取り専用dry-run。
- RH-Aへ合成カード8枚、公開済み検証テンプレートv1、イベント専用スナップショットを適用した。
- 適用後に4問・8感情・8カードのsnapshotが有効な構造であること、公開カード8件、
  participant diagnosis session 0件、private bucketを確認した。
- 診断は`enabled=false`のまま。LINE通知、外部AI、実参加者データは使用していない。
- 単体304件・結合37件、E2E 29件（3件は意図的skip）、architecture、lint、typecheck、
  build、dependency auditに成功した。
- 詳細: `docs/shime/CONCIERGE_REHEARSAL_SETUP_20260728.md`
- 次は管理者が短い利用期間を設定して診断を一時的にONにし、本人連携済みRH-A合成参加者で
  スマートフォン実機確認を行う。終了後はOFFへ戻す。

### PR #3 release反映・migration 0015 staging適用（2026-07-28 19:05）

- PR #3を`release/2026-08-08-readiness`へmergeした。merge commitは`cef5ace36768b2af82e4dc47cdf91d250d9fbdc5`。
- secretを出力しない接続確認で対象をstagingと識別し、runtime/migrationが同一DBを参照することを確認した。
- リポジトリ外へロジカルバックアップ`staging-pre-0015-20260728-185625`を作成し、
  3ファイルのsizeとSHA-256を記録した。復旧手順も適用前に確認した。
- 読み取り専用preflightはmigration head 0014、11件のscope不整合すべて0、`safe: true`。
- migration 0015をstagingへ適用し、読み取り専用postflightでmigration head 0015、
  11件のscope不整合すべて0、欠落制約・テーブル・検査なし、`safe: true`を確認した。
- 適用後はpublic tables 65、applied migrations 16、Storage private、backup readiness true。
- 単体301件・結合37件とproduction buildに成功した。
- Vercel stagingへdeployment `dpl_FgcLfXXWA5wDmzXzDhcseyCDnqLJ`を反映した。
  `https://shime-staging.vercel.app`でhealth 200、staging警告、robots拒否、
  未認証管理画面307、未認証診断API 401を確認した。
- 詳細証跡: `docs/shime/MIGRATION_0015_STAGING_RECORD_20260728.md`
- **production migration、production deploy、診断有効化、実データ利用、通知送信は未実施。**
- この完了はstaging技術反映の記録であり、本番Go判定ではない。

### CodexによるPR #3最終再レビュー（2026-07-28 18:55）

PR #3のDB scope、migration、参加者API、スタッフAPI、カード画像認可、revision conflict、
二重提出防止、診断回答非公開、モバイルE2E、既存機能への影響を再確認した。

- migration pre/postflightの初版には、全11件のscope checkが欠けても`Array.every()`が真となる場合と、
  同名制約がpublic schema内の別テーブルに存在しても合格し得る誤判定余地があった。
- `safe`判定に、DBセッションが実際にread-onlyであること、11件すべての存在、重複なしを追加した。
- postflightの制約確認を、制約名だけでなく所有テーブルと種別（UNIQUE / FOREIGN KEY）の組み合わせへ強化した。
- 実migrationをPGliteへ全適用し、期待する29制約が正しい所有テーブル・種別で存在する結合テストを追加した。
- 未選択カードの表面情報、他参加者の選択カード・回答・結果は公開されず、
  画像取得は診断有効・期間・tenant/event/participant session・現在選択カードを検証することを再確認した。
- revision conflict、提出済みsessionの再提出拒否、同一revision結果のDB重複拒否を再確認した。
- **コード上の未解決P0/P1はなし。PR #3はreleaseブランチへマージ可能と判定する。**
- ただし、この判定は本番可能判定ではない。migration適用、staging deploy、実機リハーサル、
  REQUIRED_INPUT 15件、本番Go/No-Goは未完了のまま。
- 本セッションではPR merge、DB接続、migration適用、deploy、実データ利用、通知送信を行っていない。

### Codexによるmigration 0015 staging適用前準備（2026-07-28 18:35）

staging・productionへ接続せず、migration 0015を安全に適用するための検査と手順を追加した。

- `pnpm db:preflight:0015`: migration headが0014であることと、0015が追加する複合外部キーに抵触する
  既存tenant/event不整合11種類が0件であることを読み取り専用接続で確認する。
- `pnpm db:verify:0015`: migration headが0015であること、対象テーブル5件・制約29件の存在、
  scope不整合が0件であることを読み取り専用で確認する。
- 両コマンドは`DATABASE_MIGRATION_URL`のみを使用し、セッションを
  `default_transaction_read_only=on`に設定する。出力はmigration timestamp、制約名・テーブル名、
  集計件数のみで、URL・password・PII・実データ行は出力しない。
- 正常scopeと全11種の不整合検出をPGlite合成DBで検証し、migration SQLとの検査契約同期テストを追加した。
- `docs/shime/MIGRATION_0015_STAGING_RUNBOOK.md`に、事前停止条件、backup、preflight、適用、
  postflight、失敗時の停止・復旧・証跡様式を記録した。
- **未実施**: DB接続、backup作成、migration適用、staging deploy、production操作、PR merge。
- PR #3は本追加差分の再レビューが必要なため、引き続きマージ保留。

### CodexによるConcierge template/snapshot scope修正（2026-07-28 17:50）

再レビューで、イベントsnapshotの`template_version_id`と`applied_by`が単一ID参照であり、
別tenantのテンプレート版・適用者をDBが拒否できないことを確認し、親テンプレートまで含めて修正した。

- `concierge_templates(tenant_id, id)`へ実体のあるUNIQUE制約を追加。
- `concierge_templates(tenant_id, created_by)`から`users(tenant_id, id)`への複合外部キーを追加。
- `concierge_template_versions(tenant_id, id, version)`へ実体のあるUNIQUE制約を追加。
- template versionからtemplateと作成者へのtenant複合外部キーを追加。
- event snapshotからtemplate version（version番号を含む）と適用者へのtenant複合外部キーを追加。
- 同一scopeの既存正常系を維持し、cross-tenant template、template creator、template version creator、
  snapshot template version、snapshot applierの不整合を拒否する結合テスト5件を追加。
- 0015 SQL・Drizzle schema・`0015_snapshot.json`を同期し、
  `pnpm db:generate`が`No schema changes, nothing to migrate`となることを確認。0016は残していない。
- 実装コミット: `ef23fb7`。
- migration未適用、staging未デプロイ、PR未マージ。次の作業は追加scope修正の独立再レビュー。

### CodexによるPR #3再レビュー追加指摘修正（2026-07-28 16:25）

独立再レビューで、0015のSQL・Drizzle schemaに追加済みのscope制約が
`packages/db/migrations/meta/0015_snapshot.json`へ反映されていないことと、参加者を起点とする
application/user scopeがDBで完全には固定されていないことを確認し、追加修正した。

- **migration metadata同期**: 0015 snapshotを現在のschemaから再生成し、`events_tenant_id_uidx`、
  `participants_event_scope_fk`、`event_concierge_snapshots_event_scope_fk`を含む全scope制約を同期した。
- **次migration差分確認**: 同期後に`pnpm db:generate`を再実行し、
  `No schema changes, nothing to migrate`となることを確認した。新しい0016は残していない。
- **application scope**: `applications(tenant_id, event_id, id)`へ実体のあるUNIQUE制約を追加し、
  `applications(tenant_id, event_id)`から`events(tenant_id, id)`への複合外部キーを追加した。
- **participant scope**: `participants(tenant_id, event_id, application_id)`からapplicationsへの複合外部キーと、
  `participants(tenant_id, user_id)`からusersへの複合外部キーを追加した。
- **participant session scope**: `participant_sessions(tenant_id, user_id)`から
  `users(tenant_id, id)`への複合外部キーを追加した。
- **DBテスト**: 同一scopeのapplication・participant・participant session成功に加え、cross-tenant eventのapplication、
  cross-tenant applicationのparticipant、cross-tenant userのparticipant、cross-tenant userのparticipant sessionを
  DBが拒否するテストを追加した。
- **実装コミット**: `c1627b7`。
- **安全状態**: migration未適用、staging未デプロイ、PR未マージ。次の作業は今回の追加修正の独立再レビュー。

### CodexによるPR #3レビュー指摘修正（2026-07-27 23:15）

PR #3のレビューで判明したP0/P1を修正した。**修正コードとテストは成功しているが、独立した再レビューが完了するまでマージ保留を維持する。**

- **P0修正**: `events(tenant_id, id)`へ実体のあるUNIQUE制約を追加し、`event_concierge_snapshots(tenant_id, event_id)`および`participants(tenant_id, event_id)`からイベントscopeへの複合外部キーを追加。sessionは既存のparticipant/snapshot複合FKを介して同じtenant/eventへ固定される。Drizzle schemaと未適用migration 0015を同時更新した。
- **P0テスト**: 同一tenant/eventのsnapshot INSERT成功、cross-tenant snapshot INSERT拒否、cross-tenant participant INSERT拒否を追加。既存のsession/answer/revision/result/access-log不整合拒否も再確認した。
- **P1修正**: 選択前APIはopaqueなカードIDと表示順だけを返し、タイトル・メッセージ・感情コード・画像URL等を返さない。カード選択時に空回答を許可する既存`saveDraft`へrevision付きで即時保存し、現在選択済み1枚だけ表面情報を返す。
- **P1画像認可**: 画像取得UseCaseは、診断有効・利用期間内・同一tenant/event/participant session・現在選択済みカードをすべて確認する。未選択カード、他参加者のカード、無効または期間外の診断はobject keyを返さず404となる。
- **レビュー判定**: P0/P1のコード修正は完了。PR #3は再レビューが完了するまで**マージ保留**。
- **実装コミットSHA**: `f04d045fcae7bd59a2365f7404d5b1068ffd1a23`。
- **実行済みテスト**: 単体293件・結合25件・E2E29件（すべて成功、E2E 3件は意図的skip）。architecture、lint、typecheck、build、dependency auditも成功。
- **format:check**: Windows作業ツリーのCRLFにより、今回変更していない27ファイルだけをPrettierが検出して失敗。今回変更した実装・テストは個別Prettier適用済みで、Git indexはLF。コードフォーマット不良とは区別する。
- **DB migrationは未適用**: `packages/db/migrations/0015_strange_mandroid.sql`はこのブランチにローカルで存在するのみで、staging・productionを含むどの環境にも適用していない。
- **staging環境への変更は未実施**: migration適用・デプロイ・端末確認のいずれも行っていない。
- **PR状態**: PR #3は未マージ。`release/2026-08-08-readiness`、`main`への直接pushは行っていない。
- **次のアクション**: PR #3のP0/P1修正を再レビューし、DB scope、選択前レスポンス、画像認可、revision conflict、既存機能への影響を再確認する。再レビューで問題がなければ初めてreleaseブランチへのマージ可否を判定する。

Concierge Phase 1B（SHIME診断機能）は、レビュー指摘の修正、最終再レビュー、
releaseへのPR #3 merge、staging migration、staging deploy、公開スモークまで完了した。
**migration 0015とreleaseアプリは2026-07-30にproductionへ反映済み。**
実参加者データ利用、診断有効化、通知送信は行っていない。

テスト件数（最新）:

- 単体テスト: 304件成功
- 結合テスト: 37件成功
- E2E: 29件成功・3件は意図的スキップ（モバイル専用テストのデスクトップ project skip）

検証コマンドの結果は本ファイルの「直近の検証結果」を参照。

## 現在の未完了項目

1. **クライアント初回UAT** — Web版ガイドに沿って参加者・スタッフ導線、画面文言、
   SHIME診断の使用・配置を確認し、P0/P1/P2で回答する。
2. **正式イベント情報** — `EVENT_CONFIG_20260808.yaml`の15項目をクライアントが確定する。
3. **修正後PASS席表示の実機確認** — A01本人のPASSで公開済み`T01 / T01-1`を確認する。
4. **認証済みConcierge実機確認** — production UATでは診断導線をまだ実施していない。
5. **残る導線・全規模リハーサル・復旧訓練** — 希望・結果・通知、匿名化50名、
   受付端末5台、通信障害、紙運用、バックアップ復旧の実施記録が必要。
6. **定期ジョブ・監視** — 高頻度ジョブ、障害検知、運営への通知経路を確認する。
7. **本番Go／No-Go** — 上記P0が1件でも残る間は本番可能と判定しない。

## 直近の検証結果（2026-07-28、Codex）

```text
pnpm format:check        → Windows CRLF環境差により失敗（今回未変更の45ファイル。Git indexはLF）
pnpm architecture:check  → 成功
pnpm lint                → 成功（0 errors / 68+9 warnings）
pnpm typecheck           → 成功
pnpm test                → 成功（単体304件・結合37件）
pnpm build               → 成功
pnpm test:e2e             → 成功（29件・3件は意図的スキップ）
pnpm audit:dependencies   → 成功（既知の脆弱性なし）
pnpm readiness            → 完走（productionReady: false、REQUIRED_INPUT 15件）
pnpm readiness:strict     → 失敗（exit code 1）。コード不具合ではない。
```

`pnpm format:check`で検出された45ファイルは今回の変更対象外であり、`git ls-files --eol`ではindexがLF、Windows作業ツリーがCRLFだった。今回変更した実装・テストは個別にPrettierを適用し、個別チェックと`git diff --check`に成功している。無関係ファイルの一括整形は差分拡大を避けるため実施していない。

`pnpm readiness:strict`の失敗理由: `docs/shime/EVENT_CONFIG_20260808.yaml`の`REQUIRED_INPUT`未確定項目が15件残っているため。対象キー:

```text
event.name
event.ends_at
event.venue_name
event.venue_address
application.opens_at
application.closes_at
preference.opens_at
preference.closes_at
participants.categories[0].label
participants.categories[1].label
seating.conversation_rounds
emotion_cards.card_set_code
privacy.retention_days
privacy.event_terms_version
privacy.privacy_version
```

これは運営側が確定すべき事務的な値であり、Concierge Phase 1Bの実装状態とは無関係。

`pnpm test:e2e`はこのセッションのサンドボックス環境ではPlaywright同梱ブラウザとの版数不一致（`chrome-headless-shell`欠如）のため、`playwright.config.ts`へ一時的に`launchOptions.executablePath: "/opt/pw-browsers/chromium"`を追加して実行・検証し、**検証後にコミットせず元へ戻した**。他環境で実行ファイルが見つからない場合は`pnpm exec playwright install`、またはその環境固有の`executablePath`を指定すること。

## 今回のDB scope整合性修正（2026-07-25、Claude Code）

migration 0015で追加したConciergeテーブルは、単一カラムの外部キー（`participant_id`が`participants.id`に存在する、等）はあったが、**参照先が同じtenant・eventに属することはDBレベルで強制していなかった。** アプリケーション層のRepositoryクエリは正しくtenant/event/participantで絞り込んでいたが、DB制約としては、存在すれば良いだけの緩い保証だった。

### 追加した複合UNIQUE制約（親テーブル側、複合外部キーの参照先として必要）

- `participants`: `(tenant_id, event_id, id)` — `participants_tenant_event_id_uidx`
- `event_concierge_snapshots`: `(tenant_id, event_id, id)` — `event_concierge_snapshots_tenant_event_id_uidx`
- `concierge_sessions`: `(tenant_id, event_id, id)` — `concierge_sessions_tenant_event_id_uidx`
- `users`: `(tenant_id, id)` — `users_tenant_scope_uidx`
- `concierge_card_asset_versions`: `(tenant_id, id)` — `concierge_card_asset_versions_tenant_id_uidx`

Drizzleの`uniqueIndex()`は`CREATE UNIQUE INDEX`を生成するだけで、PostgreSQLの複合外部キーの参照先として使えない（`unique or primary key constraint`が必要、単なる一意インデックスでは`there is no unique constraint matching given keys`エラーになる）。そのため`unique()`（`ADD CONSTRAINT ... UNIQUE`）を使用した。

### 追加した複合外部キー（9件）

- `concierge_sessions` → `participants`: `(tenant_id, event_id, participant_id)` → `(tenant_id, event_id, id)`
- `concierge_sessions` → `event_concierge_snapshots`: `(tenant_id, event_id, snapshot_id)` → `(tenant_id, event_id, id)`
- `concierge_sessions` → `concierge_card_asset_versions`: `(tenant_id, selected_card_asset_version_id)` → `(tenant_id, id)`（`selected_card_asset_version_id`はnullable。PostgreSQLのデフォルトMATCH SIMPLEにより、未選択時はNULLとして制約をスキップする）
- `concierge_answers` → `concierge_sessions`: `(tenant_id, event_id, session_id)` → `(tenant_id, event_id, id)`
- `concierge_answer_revisions` → `concierge_sessions`: 同上
- `concierge_rule_results` → `concierge_sessions`: 同上
- `concierge_access_logs` → `participants`: `(tenant_id, event_id, participant_id)` → `(tenant_id, event_id, id)`
- `concierge_access_logs` → `concierge_sessions`: `(tenant_id, event_id, session_id)` → `(tenant_id, event_id, id)`（`session_id`はnullable。同様にMATCH SIMPLEでスキップ）
- `concierge_access_logs` → `users`: `(tenant_id, viewer_user_id)` → `(tenant_id, id)`

既存の単一カラム外部キーはそのまま残している（複合外部キーが包含する形になるが、削除は本修正の範囲外かつリスクがあるため触れていない）。

### migrationファイルの扱い

0015はまだどの環境にも適用されていないため、`0015_giant_rick_jones.sql`は削除し、`0015_strange_mandroid.sql`として再生成した（内容はConcierge Phase 1B分＋今回の複合制約分を統合した単一migration）。Drizzle schemaとmigration SQLの内容は一致している（`pnpm db:generate`で再生成し、実PostgreSQL互換DB（PGlite）に適用して検証済み）。

**注意**: `drizzle-kit generate`が生成する文の並び順は、既存テーブルへの複合UNIQUE制約追加（`ALTER TABLE ... ADD CONSTRAINT ... UNIQUE`）を、それに依存する複合外部キー（`ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`）より後ろに置いてしまうため、生成直後はPostgreSQLが`there is no unique constraint matching given keys`で拒否した。migrationファイル内でUNIQUE制約の4文を外部キー追加ブロックの直前へ手動で移動し、解決した（新規テーブル`concierge_sessions`自身のUNIQUE制約は`CREATE TABLE`に内包されるため対象外）。今後この種の複合外部キーを追加する場合、`pnpm db:generate`後に生成SQLの文の順序を必ず確認すること。

### 追加した不整合データ拒否テスト（結合テスト、10件）

`tests/integration/concierge-diagnosis.test.ts`に`describe("concierge diagnosis cross-tenant / cross-event scope integrity")`として追加。SELECTでの分離確認ではなく、**INSERT自体がDB制約により失敗すること**を検証する。

- session→participant: 別tenantのparticipant指定で拒否
- session→participant: 同一tenant内の別eventのparticipant指定で拒否
- session→snapshot: 別tenantのsnapshot指定で拒否
- session→selected_card_asset_version_id: 別tenantのカードバージョン指定で拒否
- answer→session: 別tenantのsession指定で拒否
- answer revision→session: 別tenantのsession指定で拒否
- rule result→session: 別tenantのsession指定で拒否
- access log→participant: 別tenantのparticipant指定で拒否
- access log→session: 別tenantのsession指定で拒否
- access log→viewer_user_id: 別tenantのuser指定で拒否

### Repositoryの再確認

`packages/concierge/src/drizzle-repository.ts`の全メソッドを確認した。読み取り・更新・挿入のすべてのクエリで`tenant_id`・`event_id`（該当する場合は`participant_id`/`session_id`）がWHERE句に含まれており、tenant/event/participant条件が欠けている箇所はなかった。今回のDB制約強化はアプリケーション層の不備を修正したものではなく、アプリケーション層が正しく行っている絞り込みを、DB層でも二重に保証する防御的多層化である。

## staging migration適用の手順（次に行うこと）

1. staging Supabaseの`DATABASE_MIGRATION_URL`（direct connectionまたはsession pooler、5432番ポート）を用意できる環境で本ブランチを取得する。
2. `pnpm install`。
3. `DATABASE_MIGRATION_URL`を環境変数に設定し、`pnpm db:migrate`を実行する。
4. 適用後、`concierge_sessions`等の新規テーブルと、今回追加した複合UNIQUE制約・複合外部キーがstaging上に存在することを確認する（`\d concierge_sessions`等で外部キー一覧を確認）。
5. 診断設定はOFFのまま、Phase 1Aで保存済みの有効なスナップショットを使って端末確認を行う（staging端末確認）。
6. 端末確認後、Phase 1B完成コミットを作成し、AI_HANDOFF.mdへ適用結果を記録する。
7. 本番反映は別途レビューと明示承認を受けて行う。

## 中断時の安全状態

- `main` へのマージは行っていない。
- `release/2026-08-08-readiness` への直接pushは行っていない（PR経由）。
- Supabaseへのマイグレーション適用は行っていない（staging・production とも）。
- Vercelへのデプロイは行っていない。
- SHIME診断を既存イベントでONにする操作は行っていない。
- 外部AI接続、AI生成、AIジョブ、再試行、フォールバック処理は実装していない。
- `.env`、APIキー、LINEトークン、個人情報は変更・コミットしていない。
- 本番参加者への通知送信は行っていない。

## 既存の本番準備ベースライン（Concierge以外を含む全体像）

このブランチに先行して記録されていた本番準備情報。現時点の判定は **Go / No-Go未判定**。

確認済みの主な内容:

- staging、Supabase migration、private Storage、バックアップ基盤
- 管理者認証、権限、イベント境界、未認証API拒否
- CSV取込後の参加者生成と、イベント単位の決定論的な参加者番号採番
- 合成参加者によるLINE本人連携、Dream、5問、PASS、QR再発行、手動受付、取消、再受付
- 手動受付、本人連携一覧、管理ナビゲーション、席調整画面のスマートフォン改善
- 会場テンプレートの版管理、イベント適用、スナップショット、アーカイブ保持

本番準備として未完了・未判定の主な内容:

- `EVENT_CONFIG_20260808.yaml` の `REQUIRED_INPUT` 解消
- 正式イベント値、正式規約、保存期間の確定
- LINE期限切れ・再利用拒否、QRカメラ受付、Dream非公開・任意スキップ、5問途中保存・辞退の全確認
- 欠席後の席再計算、manager公開、公開前非表示の通し確認
- 希望入力3方式、一方希望非公開、複数成立競合、manager確定
- 結果通知のプレビュー、送信、失敗、再送、二重送信防止
- 通常CSV、責任者限定CSV、紙の受付表・席表による代替運用
- 高頻度ジョブ、監視・通知、production昇格、独自ドメイン
- 匿名化50名・受付端末5台の本番相当リハーサル

既存の本番準備P0順序:

1. 現在状態と本番準備資料の再同期
2. 合成イベントによる非ブロック導線リハーサル
3. ジョブ・監視・復旧確認
4. 正式イベント設定
5. production昇格と最終Go判定

## Concierge Phase 1Bの実装内容（参考）

### ドメイン基盤

- `packages/concierge` を新設。
- Phase 1Aで保存したイベント専用スナップショットをZodで検証。公開可能条件として4分析軸・8感情・8枚の重複しないカード対応を検証。
- 診断の開始、途中保存、提出、再回答、結果閲覧、管理設定更新、進捗集計のUseCaseを実装。
- 判定は `concierge-rule-v1` の決定論的ルールベースで、生成AIを使用しない。
- 結果は選択カード、固定感情コード、4問の選択内容から構成し、性格・相性・医学的状態を断定しない。
- DBアクセスをRepository実装に限定し、UseCaseからDrizzleを直接参照しない構造。
- 保存済み結果の読み出し境界にZodスキーマを追加。

### DBスキーマ

`packages/db/src/schema.ts` に追加:

- イベント診断設定（利用開始・終了日時、再回答許可）
- `concierge_sessions` / `concierge_answers` / `concierge_answer_revisions` / `concierge_rule_results` / `concierge_access_logs`
- `concierge_session_status` enum
- tenant/event/participant scopeを強制する複合UNIQUE制約・複合外部キー（本セッションで追加、詳細は上記）

### 参加者向け画面・API

- `/liff/diagnosis` の参加者画面。8枚を参加者セッション単位で決定論的にシャッフルし、裏面から1枚を選ぶ操作。
- 4問回答、途中保存、確認、提出、固定ルール結果表示、許可時の回答見直し。
- スマートフォン向け2列カード表示と大きい操作領域のCSS。
- 参加者API: 診断状態取得・開始・途中保存・提出・認証済みカード画像取得。
- カード画像のStorage object keyをブラウザへ返さず、認証後の署名URLリダイレクトで配信。

### 管理画面・参加者導線

- イベント別診断管理画面（SHIME診断ON/OFF、利用開始・終了日時、回答見直し許可、対象者数・進捗）。
- 管理APIに診断設定GET/PATCHを追加（GETは`concierge:manage`、PATCHは`concierge:publish`を要求）。
- 参加者導線設定でSHIME診断をON/OFFできるようにした。診断設定が有効でないイベントでは、SHIME診断を含む導線を公開できないガードを追加。
- PASS必須、Dream・席案内5問をPASSより前に置く既存制約は維持。

### 主な変更ファイル

- `packages/concierge/**`
- `packages/db/src/schema.ts`、`packages/db/migrations/0015_strange_mandroid.sql`
- `packages/event-core/src/participant-journey-types.ts` / `participant-journey-repository.ts` / `manage-participant-journey.ts` / `drizzle-participant-journey-repository.ts`
- `apps/web/src/server/concierge-diagnosis-use-cases.ts`
- `apps/web/src/hooks/use-diagnosis.ts` / `use-concierge-event-settings.ts`
- `apps/web/src/app/liff/diagnosis/page.tsx`
- `apps/web/src/app/api/liff/events/[eventId]/diagnosis/**`
- `apps/web/src/app/api/admin/events/[eventId]/concierge-status/route.ts`
- `apps/web/src/app/admin/events/[eventId]/concierge/**` / `journey/**`
- `tests/unit/concierge-diagnosis-use-cases.test.ts` / `concierge-diagnosis-routes.test.ts`
- `tests/integration/concierge-diagnosis.test.ts`
- `tests/e2e/concierge-diagnosis.spec.ts`

## E2Eで発見・修正した画面状態同期バグ（過去の記録として保持）

E2E追加中、「4問回答して確認画面へ進む」操作で回答内容が消えてカード選択画面に戻る不具合を発見した。単体・結合・契約テストでは検出できなかった、複数画面をまたぐ状態遷移特有のバグだった。

原因: `apps/web/src/app/liff/diagnosis/page.tsx`のローカル状態同期ロジックが、セッションの`id`と`revision`をキーに「セッションが変わったらサーバー状態から再同期する」処理を行っていたが、`revision`は途中保存・確認のたびに通常のフローとして毎回インクリメントされる値であり、そのたびに再同期が発火して入力中の内容を上書きしていた。さらに`apps/web/src/hooks/use-diagnosis.ts`の`save()`が`selectedCardAssetVersionId`をローカルの`session`に反映し忘れていたため、再同期時に常にカード未選択状態へ戻っていた。

修正: `save()`で`selectedCardAssetVersionId`も正しく反映し、再同期キーを`` `${session.id}:${session.revision}` ``から`` `${session.id}:${session.submittedAt ?? "null"}` ``へ変更（新規開始・再回答オープン時のみ発火し、通常の途中保存では発火しない）。

---

## 過去の状態（記録・時系列。現在の状態は本ファイル冒頭を参照）

以下はCodexからの引継ぎ時点および各セッションの作業ログであり、現在はすべて解消済みか、上記の現在の状態セクションに統合されている。個々の項目を現在の状態として参照しないこと。

### Codex引継ぎ時点（2026-07-25 13:xx、解消済み）

引継ぎ時点では次の状態だった（すべて本セッションまでに解消）:

- 追加コードは未フォーマット・未型検証だった → フォーマット・型チェックとも完了済み。
- migrationファイルが存在せず、デプロイするとDB列・テーブル不足で失敗する状態だった → migration 0015として生成・レビュー済み（未適用）。
- 単体・結合・契約・E2Eテストとも未実施だった → すべて追加・成功済み。
- `pnpm install --lockfile-only`、`pnpm db:generate`、`pnpm typecheck`の実行結果が未確認だった → いずれも完了・成功。

### 作業ログ（時系列）

**1. 型チェック・lint・migration生成（Claude Code）**

`@shime/concierge`のtsconfig/vitestパスエイリアス欠落、`use-cases.ts`の判別共用体の絞り込み不具合、`import type`と値importの混在、`exactOptionalPropertyTypes`不整合を修正し`pnpm typecheck`を通した。`react-hooks/set-state-in-effect`（React 19新ルール）によるlint error 2件をReact公式パターンに沿って解消。`scripts/check-architecture-baseline.ts`のヒューリスティックを補正（module hookからのfetchをclient component debtとして誤カウントしないよう修正、baseline値は引き下げのみ）。誤った層（同期スキーマ）を検証していたテストを、実際のUseCase層を検証する内容に修正。`pnpm db:generate`でmigration 0015を生成・レビュー。

**2. 単体テスト追加（41件、Claude Code）**

`tests/unit/concierge-diagnosis-use-cases.test.ts`。無効/期間外/不正スナップショット、4分析軸・8感情・8カード公開条件、不正回答・重複回答、途中保存・revision conflict、4問未完了時の提出拒否、決定論的な結果、再回答許可/拒否、保存済み結果のZod境界検証をカバー。

**3. 結合テスト追加（当時9件、Claude Code）**

`tests/integration/concierge-diagnosis.test.ts`。PGlite + `drizzle-orm/pglite/migrator`でmigration 0015を実DB相当環境に適用し、テーブル作成、各種unique制約、参加者間・テナント間のデータ分離、アクセスログ履歴を検証。

**4. APIルート契約テスト追加（17件、Claude Code）**

`tests/unit/concierge-diagnosis-routes.test.ts`。実際のroute.ts（`GET`/`PUT`/`POST`/`PATCH`）を`vi.mock`でDB/Storage境界のみ差し替えて検証。participant API、カード画像認可（生のストレージキーが露出しないこと）、staff APIの権限非対称性（GETは`concierge:manage`、PATCHは`concierge:publish`）をカバー。

**5. E2E追加と状態同期バグの発見・修正（Claude Code）**

`tests/e2e/concierge-diagnosis.spec.ts`。モバイル幅でのカード選択→4問回答→確認→提出→結果表示を検証。この過程で画面状態同期バグを発見・修正（詳細は上記「E2Eで発見・修正した画面状態同期バグ」参照）。

**6. DB scope整合性修正、負の結合テスト追加、文書整理（本セッション、Claude Code）**

上記「今回のDB scope整合性修正」を参照。migrationを0015のまま再生成し、複合UNIQUE制約・複合外部キーを追加。不整合データ拒否の結合テスト10件を追加（結合テスト計22件）。本ファイルを現在の状態が1箇所に集約される構成へ再編。
