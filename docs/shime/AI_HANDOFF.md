# SHIME AI引継ぎ記録

## 現在の状態（唯一の最新状態。これ以外の記述は本セクションで上書きされる過去の記録）

最終更新: 2026-07-25 17:30（Asia/Tokyo、Claude Code）
作業ブランチ: `claude/shime-codex-handoff-k76e1n`（PR #3 として `release/2026-08-08-readiness` へオープン中、未マージ）
開始時の `main`: `b07d1ce`

Concierge Phase 1B（SHIME診断機能）は、コードレベルでは完成している。型チェック・format・lint・architecture check・単体テスト・結合テスト・APIルート契約テスト・E2Eテストがすべて成功しており、CIに相当する必須検証はすべて通過済みである。DBのtenant/event整合性を複合外部キーで強制する修正も本セッションで完了した。ただし、**migrationはこのブランチのローカルmigrationファイルとして存在するのみで、staging・productionを含むどの環境にも適用していない。** 本番反映（マージ・デプロイ・DB適用・通知送信）は一切行っていない。

テスト件数（最新）:

- 単体テスト: 287件成功（うちConcierge関連: UseCase/ドメインロジック41件、APIルート契約17件）
- 結合テスト: 22件成功（うち既存migration検証3件、Concierge migration・分離12件、tenant/event scope不整合拒否10件を本セッションで追加）
- E2E: 29件成功・3件は意図的スキップ（モバイル専用テストのデスクトップ project skip）

検証コマンドの結果は本ファイルの「直近の検証結果」を参照。

## 現在の未完了項目（この6件に限定する）

1. **DB scope整合性修正** — コード・migration・単体/結合テストは本セッションで完了。staging等の実Supabase環境へ適用しての最終確認はまだ行っていない（下記「staging migration適用」で行う）。
2. **PRレビュー・マージ判断** — PR #3・PR #2 とも未マージ。レビュー待ち。
3. **staging migration適用** — このセッションにはstaging Supabaseへの認証情報・DB直結ネットワーク経路がなく、実行できない。認証情報とDB到達性のある環境（開発者ローカル、CI/CD等）で実施する必要がある。
4. **staging端末確認** — 3が完了した後、診断設定をOFFのまま実施する。
5. **`EVENT_CONFIG_20260808.yaml`のREQUIRED_INPUT** — 15項目が未確定（詳細は下記）。Concierge作業とは別系統。運営側の決定が必要でコード側では対応不可。
6. **本番準備とGo／No-Go** — 上記すべてに加え、既存の本番準備ベースライン（下記参照）の残項目が解消されるまで判定しない。

## 直近の検証結果（2026-07-25、本セッション）

```text
pnpm format:check        → 成功
pnpm architecture:check  → 成功
pnpm lint                → 成功（0 errors / 69+8 warnings、すべて本WIP以前からの既存コード由来）
pnpm typecheck           → 成功
pnpm test                → 成功（単体287件・結合22件）
pnpm build                → 成功
pnpm test:e2e             → 成功（29件・3件は意図的スキップ）
pnpm audit:dependencies   → 成功（既知の脆弱性なし）
pnpm readiness            → 完走（productionReady: false、理由は下記readiness:strictと同じ）
pnpm readiness:strict     → 失敗（exit code 1）。コード不具合ではない。
```

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
