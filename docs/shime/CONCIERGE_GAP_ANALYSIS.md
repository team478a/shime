# SHIME® 婚活AIコンシェルジュ Phase 0 差分調査

- 調査日: 2026-07-23
- 対象: `team478a/shime` / `main`
- 調査基準コミット: `174b2c32ff2aee00eb40ad6c31899c5242113a69`
- 対象仕様: 「SHIME® 婚活AIコンシェルジュ 段階開発指示書 改訂版 v2.0」
- 対象Phase: **Concierge Phase 0のみ**
- 注意: 本書は読み取り調査の記録であり、コード、DB、Migration、API、画面、外部サービス設定を変更しない。

## 1. 結論

婚活AIコンシェルジュの新規機能は、現時点ではコード実装されていない。既存Event OSには、LIFF本人認証、参加者セッション、テナント／イベント境界、Dream、席案内5問、希望入力、結果公開、通知、監査ログ、版付きテンプレート等の再利用可能な基盤がある。

ただし、次の差分はPhase 1以降の着手前に解消または決定が必要である。

1. Dreamと診断で画像・名称・メッセージのカード資産を共有しつつ、利用設定、mapping、snapshot、回答を物理的・意味的に分離する。既存Dream tableの意味は変更しない。
2. `tenant_modules` は登録されているが、API・画面の実行時ガードとして利用されていない。テナントとイベントの二段階機能フラグが必要である。
3. 診断回答原文を閲覧する専用権限、目的、理由入力、監査方法が未確定である。
4. 診断カード画像のアップロード、非公開保存、配信、版管理、削除を扱う共通Storage Providerがない。
5. AI本人レポート、ワンタップメモ、チャット、事後フォロー、90日プログラム、決済の専用データ/API/UIは存在しない。
6. 2026-08-08のEvent OS本番準備にはP0残件がある。D-01が決まるまで新機能を本番導線へ入れてはならない。

推奨判断は、Concierge機能を既定OFFの追加モジュールとして実装し、既存Event OSのDream、Love Passport、席案内5問、受付、席配置、希望、結果、通知の状態遷移を変更しないことである。

## 2. 調査方法と根拠

次を読み取り確認した。

- 指定された6つのSource of Truth
- DBスキーマとMigration 0000〜0011
- 管理者／参加者認証、LIFF、Dream、質問票、希望、結果、通知、監査、Storageの実装
- 管理画面と参加者画面のルート
- CI、Vercel Cron、テスト構成
- `EVENT_CONFIG_STATUS_20260808.md`
- `PHASE8_READINESS_REPORT.md`
- `REHEARSAL_EXECUTION_RECORD_20260715.md`
- LINE、Supabase復旧、Vercel配備の運用記録

証跡のない事項は、会話上の印象で「完了」とせず、未確認または部分確認とした。

## 3. 現在の技術構成

| 領域 | 現在の構成 | Conciergeでの扱い |
| --- | --- | --- |
| Web | Next.js 16 App Router、React 19、TypeScript | 既存アプリ内へ独立ルートを追加する |
| DB | PostgreSQL / Supabase、Drizzle ORM、Migration管理 | 専用テーブルをforward-only Migrationで追加する |
| 認証 | 管理者ID・パスワード、HttpOnly session、LIFF ID tokenのサーバー検証 | 既存セッションを利用し、毎回tenant/event/participantを再検証する |
| LINE | テナント別暗号化設定、Provider interface、Webhook署名検証 | Providerを再利用する。新規機能から直接LINE APIを呼ばない |
| AI | Dream Provider interface、OpenAIと固定文fallback | 新規レポート用Provider契約を分離する |
| Storage | Supabase private bucketによるCSV原本保管 | 診断カード画像用の共通Providerと配信方針が不足 |
| テンプレート | `resource_templates` とイベント適用スナップショット | 同じ原則を診断テンプレートへ適用する |
| 通知 | queue、attempt、dedupe、再送、管理画面 | 既存基盤を利用するが、用途別同意とdedupeを追加する |
| 監査 | `audit_logs`、運用ログの許可リスト | 回答原文・AI入力出力・私信を記録しない |
| 配備 | GitHub、Vercel staging、Supabase staging | 本番昇格はEvent OSのGo/No-Goと分離する |

## 4. 既存機能の状態固定

状態記号: `済`=証跡あり、`一部`=一部シナリオのみ、`未`=未実施、`対象外`=コードがないため検証対象なし。

| 機能 | コード実装 | 自動テスト | staging手動確認 | 本番設定 | 本番相当リハーサル | 判定根拠 |
| --- | --- | --- | --- | --- | --- | --- |
| 管理者認証・権限 | 済 | 済 | 済 | 未 | 一部 | stagingログイン、401/307、logout確認 |
| イベント設定・受付開始ガード | 済 | 済 | 済 | 未 | 一部 | 2026-08-08下書きは必須設定未完了 |
| 申込・CSV取込・参加者作成 | 済 | 済 | 済 | 未 | 一部 | 合成12名、3イベント隔離を確認 |
| LIFF本人連携 | 済 | 済 | 一部 | 未 | 一部 | RH-A01のみ実機合格、再利用・期限切れ未試験 |
| Dream・既存感情カード | 済 | 済 | 一部 | 未 | 一部 | RH-A01必須登録のみ。非公開・任意skip未試験 |
| 席案内5問 | 済 | 済 | 一部 | 未 | 一部 | RH-A01提出。途中保存・回答辞退未試験 |
| SHIME® PASS・QR | 済 | 済 | 一部 | 未 | 一部 | 表示・再発行合格、実カメラ受付未試験 |
| 手動受付・取消・再受付 | 済 | 済 | 済 | 未 | 一部 | RH-A01、短い検索、理由付き取消を確認 |
| 席配置・版付き会場テンプレート | 済 | 済 | 一部 | 未 | 一部 | 保存・固定・v3適用・アーカイブ保持確認、公開未試験 |
| 希望入力3方式 | 済 | 済 | 未 | 未 | 未 | 本番相当の全方式、締切、非公開確認が未実施 |
| 結果確定・公開 | 済 | 済 | 未 | 未 | 未 | 候補競合、manager確定、取消を未実施 |
| LINE通知・再送 | 済 | 済 | 一部 | 未 | 未 | Bot Info等は確認、実通知・失敗再送未試験 |
| バックアップ・復旧 | 済 | 済 | 済 | 未 | 一部 | 非本番復旧済み。本番直前手順は未実施 |
| SHIME診断4問 | 未 | 対象外 | 対象外 | 対象外 | 対象外 | 専用schema/API/UIなし |
| AI本人レポート | 未 | 対象外 | 対象外 | 対象外 | 対象外 | Dream AIとは別機能 |
| ワンタップメモ | 未 | 対象外 | 対象外 | 対象外 | 対象外 | 専用schema/API/UIなし |
| 24時間チャット・通報 | 未 | 対象外 | 対象外 | 対象外 | 対象外 | 専用schema/API/UIなし |
| 1週間後フォロー | 未 | 対象外 | 対象外 | 対象外 | 対象外 | 起点・同意・配信停止も未決定 |
| 90日プログラム・決済 | 未 | 対象外 | 対象外 | 対象外 | 対象外 | 商品・法務・Provider未決定 |

## 5. 既存DBと新規要件の差分

### 5.1 再利用可能

- `tenants`、`events`、`users`、`participants`による境界
- `tenant_modules`によるテナント単位のモジュール登録
- `resource_templates`、版、適用履歴、イベントスナップショットの考え方
- `notification_queue`、attempt、dedupe、再送
- `audit_logs`の操作者・対象・時刻・理由の記録
- UTC保存とJST表示の既存方針

### 5.2 そのまま再利用しない

- `emotion_card_sets`、`emotion_cards`、`emotion_selections`はDream専用である。診断用に意味を拡張しない。共通利用する画像・名称・メッセージは、新しい中立的なcard asset/version層を介して共有する。
- `questionnaires`系は席案内5問専用で、提出APIも5問を前提とする。診断4問を混在させない。
- `dream_profiles`は利用者単位のDream情報であり、イベント診断結果の保存先にしない。
- 既存Dream AI Providerへ新規本人レポートの責務を追加しない。

### 5.3 新規に必要

- 診断テンプレート、版、質問、選択肢、診断用感情カード、複合感情マッピング
- イベントごとの不変診断スナップショット
- 診断session、途中回答、提出状態、本人表示結果
- 専用機能フラグとイベント設定
- AI同意、生成job、結果、fallback版、冪等キー
- 本人メモ、変更版、トーク回との一意性
- match限定chat、member、message、block、report、期限、削除状態
- follow-up scheduleと通知同意・停止・dedupe
- プログラム利用者、商品条件snapshot、契約同意、決済Provider eventの冪等処理
- private画像の保存・配信・削除を担うStorage Provider

## 6. API・認証・公開範囲の差分

### 現在確認できた安全基盤

- 参加者APIはHttpOnly sessionを使い、eventごとにtenant、participant、active userを検証する。
- LIFFの生ID tokenはサーバーからLINEへ検証し、ブラウザ側のdecoded claimsを本人性の根拠にしない。
- 本人連携tokenはhash保存、期限、使用済み、イベント境界を持つ。
- 結果APIはmanager確定・公開前に相手情報を返さず、一方的希望や私的メモを返さない。
- LINE ProviderとDream Providerにはテスト用fakeがある。

### 不足

- `tenant_modules`を参照する共通API guardがない。
- 診断、AIレポート、メモ、チャット、プログラム用のpermissionがない。
- 診断原文閲覧のbreak-glass手順、理由入力、専用監査がない。
- 新機能のendpoint、状態遷移、idempotency contractがない。
- AIへ渡すpayloadの許可リスト、PII除去、同意version検証がない。
- チャットのmatch/member/deadline/block/report検査がない。

## 7. 画面・スマートフォンの差分

既存参加者画面にはDream、5問、PASS、希望、結果があり、管理画面にはイベント、受付、席配置、参加者、結果、外部設定等がある。320px、375px、390pxを意識したCSSと一部E2Eがある。

新規に必要な画面は次のとおり。

- 参加者: 診断説明・同意、4問途中保存、提出確認、本人レポート、メモ、チャット、フォロー、プログラム
- 管理者: テンプレート版管理、イベント適用、job状況、匿名集計、専用権限によるサポート閲覧、通報対応、商品設定
- 共通: 自動保存状態、再試行、期限、機能停止時の案内、fallback表示

既存Dreamと診断を同一画面や同一進捗として混ぜない。D-02が確定するまでLove Passportの完了条件も変更しない。

## 8. Storage・画像・ログ調査

- 現在のSupabase StorageはprivateなCSV原本保存で利用される。
- 既存感情カードの`imageKey`は文字列として扱われ、参加者画面では画像配信基盤になっていない。
- 診断カード画像には、tenant/module/versionを含むobject key、MIME・容量検査、署名URLまたは認可配信、置換ではなく版追加、参照中objectの削除防止が必要である。
- 新規の回答原文、自由記述、AI入出力、チャット本文をaudit log、operational log、例外messageへ残してはならない。
- 管理操作ログにはID、状態、件数、理由、結果codeのみを保存する。

## 9. 本番準備状況と優先順位

Event OS側の本番判定は、2026-07-14時点の報告で「本番可能ではない（P0残件あり）」である。主な残件は次の5群である。

1. 2026-08-08正式イベント設定と規約・会場席の確定
2. 本番LINE／LIFF構築と実端末検証
3. 通知5分・監視10分の高頻度scheduler
4. 認証済み全導線E2Eと匿名50名リハーサル
5. 独自domain、監視・alert、本番Supabase/Vercelへの昇格

RH-A01は、実機本人連携、Dream、5問、PASS、QR再発行、手動受付、取消、再受付まで一部通過した。しかし希望、結果、実通知、障害代替を含む全導線は未実施である。

したがってD-01が未確定の間、Concierge Phase 1以降は本番Event OSのP0解消より優先しない。実装するとしても既定OFFで、既存本番導線に依存を追加しない。

## 10. C-01〜C-20回答

| ID | Phase 0回答 | 状態 |
| --- | --- | --- |
| C-01 | 既存を`Event OS Phase`、追加開発を`Concierge Phase`と呼ぶ。 | 解決 |
| C-02 | 既存emotion tablesの意味を変えない。画像・名称・メッセージは中立的なcard asset/versionとして共有し、Dream/診断の利用設定、mapping、snapshot、回答を分離する。 | 追加要件で方針確定 |
| C-03 | Dreamと診断は別module・別回答・別完了状態とする。順序と必須性はD-02待ち。 | 一部未確定 |
| C-04 | templateはtenant+module所有、版付き、eventへ不変snapshotをコピーする。platform共有可否はD-03待ち。 | 一部未確定 |
| C-05 | 通常のreception/operator/manager/system_adminへ原文を自動公開しない。専用権限と目的はD-07待ち。 | 一部未確定 |
| C-06 | AI payloadは許可リスト方式でPIIを除外する。同意・Provider・保存期間はD-08/D-09待ち。 | 一部未確定 |
| C-07 | 8感情・4軸・回答コードから決定的に組み立てる、非断定の版付きfallbackを必須とする。 | 方針解決 |
| C-08 | 8内部codeを固定し、表示labelとmappingはtemplate/event snapshotへ保存する。正式labelはD-05待ち。 | 一部未確定 |
| C-09 | Phase 1からmodule contract、Provider、version、tenant/event scopeを適用する。 | 解決 |
| C-10 | UTC保存/JST表示、server判定は必須。24時間の起点・取消時の扱いはD-12待ち。 | 一部未確定 |
| C-11 | 規約同意、block、report、対応記録、通常時の私信非公開を必須とする。詳細はD-13待ち。 | 一部未確定 |
| C-12 | schedule/dedupe/停止を既存通知基盤へ追加する。起点・対象はD-14待ち。 | 一部未確定 |
| C-13 | 商品条件はversion付き設定、申込時snapshot、Provider interfaceとし、hardcodeしない。 | 解決 |
| C-14 | 決済・法務・取消条件はD-16〜D-18確定まで実装禁止。 | 未確定 |
| C-15 | Event participantとProgram member、同意、保持、権限を別契約・別domainとして管理する。 | 解決 |
| C-16 | 本書4章の5段階で固定した。コンシェルジュ新機能はすべて未実装。 | 解決 |
| C-17 | Event OS P0を優先し、Conciergeは別flag・別Go/No-Goとする。本番採用はD-01待ち。 | 一部未確定 |
| C-18 | 各Phaseでlint、typecheck、unit、integration、build、該当E2Eを明示実行する。 | 解決 |
| C-19 | flag停止、旧app切戻し、forward-fixを優先し、データ破棄down migrationを自動実行しない。 | 解決 |
| C-20 | 自己理解支援であり診断・成果保証ではない旨を表示する。正式表記は法務・監修者確認待ち。 | 一部未確定 |

## 11. リスク

| 優先度 | リスク | 対応 |
| --- | --- | --- |
| P0 | 既存Dream/5問の意味や状態を変更 | 専用schema/API/UI、既定OFF、回帰test |
| P0 | tenant/event越境 | 共通guard、複合unique/FK、negative integration test |
| P0 | private回答・希望・chatの漏えい | 本人限定、専用permission、理由・監査、log禁止 |
| P0 | 新機能が8月8日本番準備を遅延 | D-01 gate、Event OS P0優先、別Go/No-Go |
| P1 | AI送信・重複課金・不正出力 | consent、allowlist、idempotency、schema、fallback |
| P1 | module flagが形だけになる | API server gateを先に実装し、UI非表示だけに頼らない |
| P1 | 画像URL漏えい・履歴破損 | private storage、短期署名、immutable version |
| P1 | chat通報対応不能 | 規約、担当、SLA、停止、証跡を開始条件にする |
| P2 | 婚活固有文言の共通層混入 | module configへ隔離し他service contract testを追加 |

## 12. Phase 0判定

- Phase 0調査: 完了
- Concierge Phase 1A開始: **未承認・開始条件未達**
- 未達条件: 少なくともD-01〜D-07の確定、および本書と実装計画の承認
- この時点で実施してよい次作業: 文書レビュー、D項目の意思決定、Event OS本番P0の解消
- この時点で実施しない作業: Conciergeのコード、DB、Migration、API、UI、外部接続、本番設定
