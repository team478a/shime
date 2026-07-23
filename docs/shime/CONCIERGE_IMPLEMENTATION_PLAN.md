# SHIME® 婚活AIコンシェルジュ 実装計画

- 作成日: 2026-07-23
- 対象仕様: 段階開発指示書 改訂版 v2.0
- 現在の承認範囲: **Concierge Phase 0のみ**
- 実装開始条件: 本計画承認後、各PhaseのDゲートを満たし、別指示を受けること

## 1. 設計原則

1. 既存Event OSを優先し、Dream、Love Passport、席案内5問、受付、席配置、希望、結果、通知の既存状態遷移を変更しない。
2. Conciergeを追加moduleとして実装し、tenantとeventの両方で既定OFFにする。
3. 共有層は認証、権限、通知、監査、Storage、Provider、版管理のcontractに限定し、婚活固有の文言・分析・商品をmodule内へ置く。
4. templateとevent instanceを分離し、利用開始時の不変snapshotを保存する。
5. privateな回答、Dream、希望、メモ、AI入出力、chatは最小権限とし、他参加者や通常スタッフへ公開しない。
6. AIは文章生成のみとし、席、希望、matching、公開可否を決定しない。障害時は決定的fallbackで本人導線を継続する。
7. 全timestampはUTC保存、Asia/Tokyo表示。全schema変更はforward-only Migrationとする。
8. 参加者・現地スタッフ双方でスマートフォンを主端末とし、入力削減と大きなtouch targetを維持する。

## 2. module境界

既存の語彙に合わせ、共通識別子は`module_key`を使用する。`service_module`という同義の別列は増やさない。

| module | 責務 | 既存との関係 |
| --- | --- | --- |
| `core` | tenant/event/auth/permission/audit/notification/storage contract | 既存を拡張 |
| `dream` | 既存Dreamと感情card | 変更しない |
| `seating` | 既存5問と席決定 | 変更しない |
| `matching` | 既存希望・成立候補・結果 | 決定logicは変更しない |
| `concierge_diagnosis` | 診断template、4問、8感情、本人結果 | 新規 |
| `concierge_report` | AI job、fallback、本人report | 新規 |
| `concierge_memo` | talk回ごとの本人メモ | 新規 |
| `concierge_chat` | 確定match限定chat、安全運用 | 新規 |
| `concierge_program` | 事後program、商品、契約、決済 | 新規 |

コードは既存monorepoを維持し、`packages/core/src`内のdomain folderと`apps/web`内のroute/pageへ分離する。Phase 1で新package分割は行わず、循環依存や別serviceからの利用が必要になった時点でADRを作る。

## 3. 機能フラグ計画

### 3.1 二段階gate

1. tenant gate: 既存`tenant_modules`でmoduleの利用可否と期間を管理する。
2. event gate: 新規の版付きevent module設定で、対象eventのみ有効化する。

APIは両方をserver側で検査し、UI非表示だけに依存しない。tenant無効、期間外、event無効、snapshot未準備のいずれかでは、読み書きを拒否する。参加者には安全な「現在利用できません」を返し、存在しない他tenant/eventの情報は返さない。

### 3.2 推奨flag

| Flag | 初期値 | 対象Phase |
| --- | --- | --- |
| `concierge_diagnosis` | OFF | 1A/1B |
| `concierge_report` | OFF | 2A/2B |
| `concierge_memo` | OFF | 3 |
| `concierge_chat` | OFF | 4A/4B |
| `concierge_followup` | OFF | 4B |
| `concierge_program` | OFF | 5 |

緊急停止はDBのtenant/event flagで行い、再deployを必須にしない。停止しても既存Event OSは動作し続ける。

## 4. データ設計案

以下は実装前の設計案であり、Phase 0ではschemaを変更しない。全tenant/event data queryに複合境界を含める。

### 4.1 共通module設定

- `event_module_settings`
  - `tenant_id`, `event_id`, `module_key`, `enabled`
  - `config_version`, `config_json`, `starts_at`, `ends_at`
  - `created_at`, `updated_at`
  - unique: tenant + event + module

### 4.2 Concierge Phase 1A

- `diagnosis_templates`
- `diagnosis_template_versions`
- `diagnosis_questions`
- `diagnosis_options`
- `card_assets`
- `card_asset_versions`
- `diagnosis_card_sets`
- `diagnosis_card_mappings`
- `diagnosis_emotion_mappings`
- `event_diagnosis_snapshots`

Templateはtenant+module所有とし、versionは公開後immutableにする。Snapshotには質問、選択肢、正式label、card、mapping、表示文、schema version、hashを含める。後日のtemplate編集は進行中・過去eventへ波及させない。

`card_assets`と`card_asset_versions`は、Dreamと診断が共有できる中立的な画像・名称・メッセージ資産とする。既存`emotion_cards`の意味は変更せず、nullableな関連または互換mappingを通じてcard asset versionを参照できるようにする。Dreamと診断の利用設定、表示順、感情mapping、event snapshot、選択結果は共有しない。画像差し替えでは既存objectを上書きせず、新しいasset versionとcard versionを作成する。

8感情の内部codeは共通不変値とし、表示labelはversion dataとする。正式code一覧はPhase 1A PRで仕様と照合して定義し、DB enumではなく検証済みcode tableまたはversioned contractを優先する。

### 4.3 Concierge Phase 1B

- `diagnosis_sessions`
  - participant、snapshot、`not_started/in_progress/submitted`、revision、submitted_at
- `diagnosis_answers`
  - session、question、option/value、updated_at
- 必要なら`diagnosis_results`
  - 決定的分類結果だけを保存し、AI文章は保存しない

同一event/participantのactive sessionは一つとする。途中保存はrevisionまたはupdated_atによる楽観lockを使い、submitはtransaction内で設問、必須性、snapshot版、本人を再検証する。提出後の修正規則はD-06で確定する。

### 4.4 Concierge Phase 2

- `ai_processing_consents`
- `ai_report_jobs`
- `ai_reports`
- 必要なら`ai_report_attempts`

Jobはtenant/event/participant/session/report kind/prompt versionのidempotency keyを持つ。入力payloadは保存せず、必要な回答codeとversionへの参照を持つ。結果は本人限定で、provider、model、prompt/fallback version、状態、期限、sanitized error codeを記録する。API key、raw request、raw response、自由記述をlogへ残さない。

### 4.5 Concierge Phase 3

- `interaction_memos`
- 必要なら`interaction_memo_revisions`

uniqueはtenant + event + owner participant + partner participant + conversation round。本人以外へ公開しない。希望入力はメモを参照表示できるが、自動で希望を選択・提出しない。

### 4.6 Concierge Phase 4

- `chat_rooms`, `chat_members`, `chat_messages`
- `chat_blocks`, `chat_reports`, `chat_moderation_actions`
- `followup_schedules`, `followup_responses`

Roomはmanager確定済みmatchからだけ生成する。送信時はroom、member、match status、期限、block、suspensionをserverで毎回検査する。Message本文はaudit logへ複製しない。通報時も通常管理者が無制限に私信を閲覧できない設計とする。

### 4.7 Concierge Phase 5

- `program_products`, `program_product_versions`
- `program_members`, `program_consents`, `program_enrollments`
- `payment_customers`, `payment_subscriptions`, `payment_events`

Event参加とProgram契約を分離する。申込時の商品条件snapshotを保持し、Provider webhook event IDをuniqueにして冪等処理する。card情報は保持しない。

## 5. API計画

Route名は実装時に既存規約へ合わせる。最低限、次の境界を維持する。

### 5.1 参加者API

- `/api/liff/events/[eventId]/diagnosis`
- `/api/liff/events/[eventId]/diagnosis/session`
- `/api/liff/events/[eventId]/diagnosis/submit`
- `/api/liff/events/[eventId]/concierge-report`
- `/api/liff/events/[eventId]/interaction-memos`
- `/api/liff/events/[eventId]/chat/...`
- `/api/liff/events/[eventId]/program/...`

共通検査順:

1. sessionとactive user
2. event存在とtenant一致
3. participant本人と参加状態
4. tenant module flag
5. event module flagと期間
6. resource所有・状態・version
7. 操作固有の状態遷移とidempotency

### 5.2 管理API

- template/versions/publish/archive
- event snapshot/apply/enable/disable
- report job status/retry
- 匿名化集計
- diagnosis support read（D-07確定後、理由必須）
- chat report/moderation
- product/payment operations

管理APIは新しい専用permissionで保護する。`system_admin`というrole名だけを原文閲覧根拠にしない。

### 5.3 Provider contract

- `ConciergeReportProvider`: structured inputからversion付きstructured outputを返す
- `FixedConciergeReportProvider`: 外部接続不要の決定的fallback
- `ObjectStorageProvider`: private put/get/delete、metadata、signed access
- 将来の`PaymentProvider`: checkout、webhook verify、subscription lifecycle

テストはFake Providerを使用し、CIで外部AI、LINE、Storage、決済へ接続しない。

## 6. 画面・導線計画

### 6.1 参加者

Phase 1ではDreamと診断の入口・説明・進捗を別表示する。D-02確定までは既存Passportのready条件へ診断を追加しない。

- 4問は一画面一問または短いstepで、選択済み状態を保持する。
- 戻る、reload、LIFF再起動で途中回答を復元する。
- submit前に確認を設け、結果に影響する操作を誤tapで確定しない。
- 320/375/390pxで横scrollを発生させない。
- 自動保存は「保存中／保存済み／再試行」を文字でも示す。
- primary actionは44px以上を目安とし、片手操作で到達しやすくする。

### 6.2 管理者

- 管理topから対象eventのConcierge設定へ短い導線を置く。
- template編集とevent snapshot適用を明確に分ける。
- 公開済みversionは直接編集させず、新versionとして複製する。
- job一覧は状態、件数、再試行可否のみ表示し、回答原文を一覧へ出さない。
- 現地操作は短いprefix/部分検索、候補選択、preset、文脈保持を継承する。

## 7. 権限案

最終名はPhaseごとに既存permission contractへ追加する。

| 権限案 | 用途 | private本文 |
| --- | --- | --- |
| `diagnosis:configure` | template/event設定 | 不可 |
| `diagnosis:operate` | status/job確認 | 不可 |
| `diagnosis:support_read` | 本人問い合わせ時の原文閲覧 | D-07の理由・監査付きのみ |
| `concierge_report:retry` | job再試行 | 入力原文不可 |
| `chat:moderate` | 通報対応 | D-13の手続範囲のみ |
| `program:configure` | 商品・program設定 | 契約必要情報のみ |
| `payment:operate` | 支払状態確認・再同期 | card情報不可 |

受付担当へ追加権限を与えない。権限変更自体をauditする。

## 8. Privacy・保持・削除

確定前の原則:

- 本人回答、メモ、レポート、chatは本人または契約上必要な限定主体だけが扱う。
- 他参加者へ一方的希望、rank、private Dream、診断回答、メモを返さない。
- AIへ氏名、電話、email、LINE ID、参加者番号、tenant名、event名を送らない。
- 自由記述はD-08の最小化方式が決まるまで外部AIへ送らない。
- 削除は`deletion_requested_at/deleted_at`等で追跡し、法的保持と利用停止を区別する。
- Backup内データの期限と復元後の再削除手順もretention設計へ含める。

保持日数はD-08、D-10、D-13、D-16で確定する。未確定値をコードに仮置きしない。

## 9. Phase別実装順

### Concierge Phase 1A: 診断基盤・版管理

開始条件: D-01〜D-07確定、本計画承認。

- module/event gateと共通server guard
- 診断template、version、4問、option、8感情、card、mapping
- event snapshotとhash
- 管理画面の作成、version履歴、preview、適用、archive
- private card image Storage Provider
- 画像差し替え時の新asset version・新card version作成と旧版archive
- 拡張子、MIME、実画像signature、decode、容量、寸法、総pixel、hash、重複、破損のserver検証
- EXIF等のmetadata除去、安全な形式への再encode後のprivate Storage保存
- AIレポートのタイトル、見出し、固定文、免責文、案内文の設定・版管理
- 認証、権限、本人確認、個人情報、AI同意、system error文言の固定文または承認済みkey制御
- 公開時の4分析軸・8固定感情code完全性検証
- 既存Dream/5問の回帰test

Phase 1Aでは外部AI接続、生成、job、再試行、fallback処理を実装しない。公開済みtemplate、card、画像は直接上書きせず、変更時は新versionを作成する。詳細は`CONCIERGE_PHASE1A_CONFIRMED_REQUIREMENTS.md`を正とする。

### Concierge Phase 1B: 参加者診断

- session、途中保存、復元、submit、本人結果
- smartphone UIと管理status
- tenant/event越境、提出競合、再送、他人参照のnegative test
- Dream/Passportとの導線はD-02どおりflag設定

### Concierge Phase 2A: AI安全基盤

開始条件: D-08/D-09確定。

- consent version、allowlisted DTO、PII禁止
- job idempotency、timeout、retry、rate/cost limit
- structured schema validation
- fixed deterministic fallback

### Concierge Phase 2B: 外部AI・本人report

- 外部Provider接続、本人限定report
- fallback切替、再生成制限、monitoring
- Provider障害中も既存Event OSと診断提出を継続

### Concierge Phase 3: ワンタップメモ

開始条件: D-10/D-11確定。

- round単位の本人memo、auto save、競合処理
- 希望入力への参照導線のみ。自動選択・自動提出は禁止

### Concierge Phase 4A/4B: chat・follow-up

開始条件: D-12〜D-14、規約、通報責任者確定。

- まず安全基盤、次に24時間chat
- 時刻はserver判定、取消・block・停止を即反映
- 1週間後schedule、dedupe、通知停止

### Concierge Phase 5: program・決済

開始条件: D-15〜D-18、法務文書、本番決済account確定。

- version付き商品、別同意、program membership
- Provider、署名、idempotent webhook、subscription state
- 金額・無料期間をhardcodeしない

### Concierge Phase 6: 他service検証

- 別service/moduleでtemplate、Provider、permission、notificationを利用
- 婚活固有couplingを抽出してcontract test
- Phase 1から採用した共通設計を仕上げるPhaseとする

## 10. Migration・ロールバック

- MigrationはPhase/PRごとに小さくし、既存列の意味変更・削除を行わない。
- 新table/nullable列/新indexを先に追加し、flag OFFでdeployする。
- app rollbackは旧codeへ戻しても新tableが残る後方互換状態を保つ。
- 障害時はevent/tenant flag OFF、job claim停止、旧app切戻し、forward-fixの順で対応する。
- 本番dataを削除するdown migrationは用意・自動実行しない。
- 破壊的cleanupは保持期限、backup、責任者承認を満たす別Phaseとする。

## 11. Test・受入計画

各behavior changeで次を実施する。

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm build
pnpm test:e2e
```

重点test:

- tenant Aからtenant Bを参照・更新できない
- event Aのparticipantがevent Bを参照できない
- 本人以外が回答、memo、report、chatを取得できない
- 通常staffにprivate本文が返らない
- module/event OFF時はAPIも拒否し、既存機能は継続する
- template更新が既存event snapshotへ波及しない
- 同じsubmit/job/webhookを再送しても重複しない
- AI timeout、不正JSON、rate limitでfallbackする
- log/auditにPII、回答原文、token、keyがない
- 320/375/390px、reload、戻る、LIFF再起動、自動保存失敗
- Dream、5問、Passport、受付、席、希望、結果、通知の回帰

stagingでは合成dataだけを使い、Phaseごとに管理者と参加者の認証済み実機確認を行う。本番利用する場合はConcierge用Go/No-GoをEvent OS本番判定とは別に記録する。

## 12. 変更ファイル予定

Phase 1以降の候補であり、Phase 0では変更しない。

- `packages/db/src/schema.ts`
- `packages/db/migrations/*`
- `packages/core/src/modules/*` または既存export規約に沿うdomain folder
- `apps/web/src/app/api/liff/events/[eventId]/*`
- `apps/web/src/app/api/admin/events/[eventId]/*`
- `apps/web/src/app/liff/*`
- `apps/web/src/app/admin/events/[eventId]/*`
- `apps/web/src/lib/server/*`
- unit/integration/E2E test files
- `docs/shime/*` のPhase完了記録、運用手順、privacy data map

正確なfile listは各Phase開始時に再調査してPRへ記載する。

## 13. D-01〜D-18決定表

「推奨」は設計上の提案であり、決定者の承認までは未確定である。期限はそのPhaseへ入るための最遅gateであり、着手を約束する日ではない。

| ID | 現在の回答・推奨 | 状態 | 決定者 | 期限/gate |
| --- | --- | --- | --- | --- |
| D-01 | 8月8日はEvent OS P0解消を優先。Concierge 1〜3は全受入・リハーサルを満たさない限り本番OFFを推奨。 | 未確定 | 事業責任者・運営責任者 | **2026-07-24**、Phase 1前 |
| D-02 | Dreamと診断は別機能。順序、必須/任意、Passport条件はevent設定とする案。 | 未確定 | Product責任者 | Phase 1前 |
| D-03 | tenant+module所有、event snapshot。platform共通seed共有の可否が未決定。 | 未確定 | Product・技術責任者 | Phase 1前 |
| D-04 | 画像・名称・メッセージのcard資産をDream/診断で共有し、利用設定・mapping・snapshot・回答を分離する。既存emotion tablesの意味は変えない。 | **追加要件で確定** | 物理schemaを技術責任者が設計レビュー | Phase 1前 |
| D-05 | 内部code固定、婚活向け表示labelはversion管理。正式label未決定。 | 未確定 | Client・監修者 | Phase 1前 |
| D-06 | 正式4問、選択肢、必須性、提出後修正可否が未決定。 | 未確定 | Client・監修者 | Phase 1前 |
| D-07 | 通常staffは原文不可。`diagnosis:support_read`相当、本人問い合わせ、理由必須を推奨。 | 未確定 | 個人情報管理責任者 | Phase 1前 |
| D-08 | AI同意文、privacy改訂、各data保持日数、削除/撤回手順が未決定。 | 未確定 | 法務・個人情報管理責任者 | Phase 2前 |
| D-09 | Provider interface+fallbackは確定方針。Provider、model、token/金額/回数上限は未決定。 | 未確定 | 技術・事業責任者 | Phase 2前 |
| D-10 | memo選択肢、自由記述有無、保持期間が未決定。 | 未確定 | Client・運営責任者 | Phase 3前 |
| D-11 | 本人限定を初期値とし、管理者閲覧の目的・手続は未決定。 | 未確定 | 個人情報管理責任者 | Phase 3前 |
| D-12 | 起点はmanagerによる個別結果公開時刻を推奨。取消時は即停止。最終決定待ち。 | 未確定 | 運営責任者 | Phase 4前 |
| D-13 | chat規約、禁止事項、通報担当/SLA、保存・削除期間が未決定。 | 未確定 | 法務・運営責任者 | Phase 4前 |
| D-14 | 起点、成立/不成立の対象、通知停止・block時の扱いが未決定。 | 未確定 | 運営責任者 | Phase 4前 |
| D-15 | 「夢登録」「未来登録」等の正式名称が未決定。 | 未確定 | Client | Phase 5前 |
| D-16 | 商品名、価格、税込、無料期間、初回課金、解約、返金が未決定。 | 未確定 | 事業責任者・法務 | Phase 5前 |
| D-17 | 決済事業者、本番account、3DS、運用担当が未決定。 | 未確定 | 事業・経理・技術責任者 | Phase 5前 |
| D-18 | 特商法表示、提供主体、問い合わせ窓口が未決定。 | 未確定 | 法務・事業責任者 | Phase 5前 |

## 14. Phase 1A開始前チェックリスト

- [ ] `CONCIERGE_GAP_ANALYSIS.md`と本書を責任者が承認
- [ ] D-01〜D-07を決定し、責任者と決定日を記録
- [ ] 8月8日本番で利用するか、明示的にOFFにするか決定
- [ ] Event OS本番P0の担当・期限と競合しない作業枠を確保
- [ ] 正式な診断文言・label・privacy公開範囲を受領
- [ ] Phase 1Aのschema/API/UI/permission/testをPR単位に再確認
- [ ] staging backupとrollback/flag停止手順を確認
- [ ] 別指示でConcierge Phase 1Aの開始承認を受ける

## 15. 現在の停止点

Concierge Phase 0の文書作成までを実施した。D-01〜D-07が未確定であり、Phase 1Aの開始承認もないため、ここで停止する。次の優先作業は、本書のレビューとD-01〜D-07の意思決定、並行してEvent OS本番P0の解消である。
