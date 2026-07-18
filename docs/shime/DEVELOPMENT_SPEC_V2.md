# SHIME 婚活イベント 開発仕様書 v2.0

- 対象イベント：2026年8月8日
- 文書目的：開発着手・実装・受入テストの基準を一本化する
- 前提：SHIME Concierge Coreに婚活イベント機能を追加する
- 対象画面：参加者向けLINE LIFF／公開申込フォーム／運営管理画面
- 仕様基準日：2026年7月12日

## 1. 確定したプロダクト方針

### 1.1 参加申込み

次の2方式を両方実装する。

1. SHIME内の申込フォーム
2. 外部で受け付けた申込みのCSV取込

両方式で作成された申込みは、同じ `applications` テーブルへ格納し、以降のLINE連携、Dream登録、Love Passport発行、受付、席案内、希望入力を共通処理する。

### 1.2 夢登録

イベントごとに管理画面で次の方式を選択できる。

- `required_private_allowed`：夢登録必須。公開は任意
- `optional`：夢登録自体が任意

9999人夢応援プロジェクトへの参加、ニックネーム・夢の公開は常に本人の任意同意とし、婚活イベント参加の必須同意と分離する。

### 1.3 希望入力・成立方式

イベントごとに管理画面で次の3方式を選択できる。

- `mutual_up_to_2`：最大2名、順位なし
- `first_choice_only`：第1希望1名のみ
- `ranked_up_to_3`：第1〜第3希望

全方式で、システムは双方希望候補を抽出するだけとし、最終結果は運営責任者が確定する。

### 1.4 現地運用のスマートフォン優先原則

- 現地スタッフはPCを利用できない場合を前提とし、受付、取消、参加者確認、席確認、結果・通知確認はスマートフォン単体で完結できること
- システムが保有するテナント、イベント、参加者、状態は再入力させない
- 文字入力より、短い前方一致・部分一致検索、候補選択、理由プリセット、ボタン選択を優先する
- 一覧表の横スクロールを前提にせず、スマートフォンで候補、状態、主操作を認識できること
- 後戻りやセッション切れで作業をやり直さないよう、イベント文脈と進捗を維持する
- 入力削減の場合も、テナント・イベント境界、権限、重要操作前の確認、二重実行防止、監査ログは維持する

### 1.5 SHIME運営OSとしての横展開原則

SHIMEは婚活イベント単体の専用アプリではなく、複数事業、複数イベント種別、複数機能を組み合わせて運営できる基盤として発展させる。

- 認証、権限、監査、申込フォーム、通知、ジョブ、ファイル、外部接続、テンプレート管理は共通プラットフォーム機能とする
- 婚活、Dream支援などの業務固有機能は、共通基盤の上に載るサービスモジュールとして分離する
- データの境界は `tenant`、`service/module`、`event` の順に明示し、検索、更新、権限判定、監査へ一貫して適用する
- モジュール間連携は公開された契約、プロバイダーインターフェース、版付き設定またはドメインイベントを通し、相互の内部テーブルへ直接依存しない
- 会場、フォーム、通知文、カードセットなど再利用可能な定義はテンプレートとして管理し、イベントでは使用時点の版付きスナップショットを保持する
- 既存イベントの履歴再現性を優先し、共通テンプレートの更新によって進行中または完了済みイベントを暗黙に変更しない
- 管理画面のナビゲーションと権限は有効なモジュールに応じて構成し、利用しない機能を強制しない
- 2026年8月8日のP0を不安定にする全面改修は避け、境界と契約を保ちながら段階的に共通化する

## 2. MVPの完成条件

以下が本番環境で一連に動作することを完成条件とする。

1. SHIME申込フォームまたはCSVで参加者を登録できる
2. 参加者がLINEからLIFFを開き、申込みと本人を紐づけられる
3. 新規・登録済みユーザーを分岐できる
4. イベント設定に従って夢登録を必須または任意にできる
5. 感情カード、Dream No.、Love Passportを扱える
6. 席案内5問に回答できる
7. 運営が初期席配置案を作成・修正・確定できる
8. QRまたは手動で受付できる
9. 参加者が確定席を確認できる
10. 設定された方式で希望入力できる
11. 運営が双方希望候補を確認し、結果を確定・通知できる
12. AIが停止しても固定文とルールベース処理で本番運用を継続できる

## 3. システム構成

### 3.1 推奨技術構成

| 領域 | 採用方針 |
|---|---|
| フロントエンド | React／Next.js／TypeScript、スマートフォン優先 |
| LIFF | LINE Front-end Framework SDK |
| バックエンド | Next.js Route HandlerまたはNode.js API層 |
| データベース | PostgreSQL |
| ORM | PrismaまたはDrizzleのどちらかに統一 |
| ファイル保管 | S3互換ストレージ。カード画像、CSV原本、出力ファイル |
| AI | プロバイダー交換可能なAI Gateway層 |
| 通知 | LINE Messaging API |
| 定期処理 | ジョブキューまたはスケジューラー |
| 監視 | エラー監視、構造化ログ、死活監視 |
| デプロイ | 初期はVercel＋マネージドPostgreSQLを推奨 |

### 3.2 アプリケーション境界

- `/liff/*`：参加者用LIFF
- `/apply/*`：SHIME公開申込フォーム
- `/admin/*`：運営管理画面
- `/api/public/*`：申込み等の公開API
- `/api/liff/*`：LIFF認証済みAPI
- `/api/admin/*`：運営認証済みAPI
- `/api/webhooks/line`：LINE Webhook
- `/api/jobs/*`：内部ジョブ専用。外部公開しない

### 3.3 モジュール境界

- Core：テナント、イベント、認証、権限、同意、通知、監査
- Application：申込フォーム、CSV取込、重複判定
- Dream Profile：感情カード、夢、Dream No.
- Event Passport：Love Passport、QR、受付
- Seating Guide：5問、採点、席配置案、確定
- Matching：希望入力、双方希望候補、結果確定

モジュール利用可否は `tenant_modules` で制御し、画面を隠すだけでなくAPIでも拒否する。

## 4. LINE・LIFF認証仕様

### 4.1 認証フロー

1. LIFF起動後に `liff.init()` を実行
2. 未ログイン時はLINEログインへ誘導
3. クライアントは `liff.getIDToken()` で取得した生のIDトークンをサーバーへ送る
4. サーバー側でトークンを検証する
5. 検証済みLINE user IDを `user_identities` と紐づける
6. サーバーがSHIME用セッションを発行する

クライアントでデコードしたプロフィール情報を本人確認済み情報としてサーバーへ送らない。サーバーは必ずLINE発行トークンを検証する。

### 4.2 申込み紐づけ

- 申込完了時に推測困難な `link_token` を発行
- 有効期限は原則72時間。管理画面から再発行可能
- LIFF URLにトークンを付ける場合、利用完了後は即時失効
- 氏名だけでは紐づけない
- 補助確認として電話番号下4桁または生年月日を利用可能
- 1申込みを複数LINEアカウントへ紐づけない
- 再紐づけは運営責任者権限と理由入力を必須にする

### 4.3 LINE Webhook

- Webhook署名を検証してから処理する
- 友だち追加、ブロック、メッセージ等を必要範囲で保存
- Webhookは速やかに2xxを返し、重い処理は非同期化
- `webhookEventId` 等を利用し、同一イベントの重複処理を防ぐ

### 4.4 通知

- Passport発行完了
- 5問未回答リマインド
- 前日案内
- 当日案内
- 希望入力開始
- 希望入力締切前
- 結果公開

通知は `queued → sending → sent / failed / cancelled` で管理し、再送時も履歴を残す。

## 5. イベント設定

### 5.1 必須設定項目

| 項目 | 型・例 |
|---|---|
| イベント名 | 文字列 |
| 開催日時／終了日時 | timestamp with timezone |
| 会場・住所 | 文字列 |
| 定員 | 整数 |
| 申込受付期間 | 開始・終了日時 |
| 参加者番号形式 | M/F等の接頭辞＋連番、または連番のみ |
| 夢登録方式 | `required_private_allowed` / `optional` |
| 希望入力方式 | 3方式から選択 |
| 希望入力開始・締切 | timestamp |
| 結果公開日時 | timestampまたは手動 |
| 席構成 | テーブル、席番号、定員 |
| 組合せ区分 | イベント固有の対象区分 |
| 席案内5問テンプレート | バージョン指定 |
| 感情カードセット | バージョン指定 |
| 連絡先交換方式 | 運営仲介／同意後表示等 |

### 5.2 状態遷移

イベント状態：

`draft → accepting → registration_closed → checkin_open → in_progress → preference_open → preference_closed → result_confirmed → completed`

- 前の状態へ戻す操作は運営責任者のみ
- `result_confirmed` からの変更はシステム管理者のみ
- 状態変更は監査ログへ保存

## 6. 申込フォーム仕様

### 6.1 画面

1. イベント概要
2. 参加条件確認
3. 申込情報入力
4. 規約・個人情報同意
5. 入力確認
6. 申込完了・LINE追加誘導

### 6.2 標準入力項目

- 氏名
- 氏名かな
- 生年月日
- 電話番号
- メールアドレス
- ニックネーム
- 居住エリア（市区町村までを推奨）
- イベントで必要な参加区分
- 参加条件への確認
- イベント規約同意
- 個人情報取扱い同意

項目ごとに `required / optional / hidden` をイベント設定できる構造とする。ただし、本人照合に必要な氏名、電話またはメール、参加区分、必須同意は非表示にできない。

### 6.3 申込み状態

`draft → submitted → confirmed → cancelled / rejected / waitlisted`

MVPでは決済を扱わない。参加確定は管理画面で一括または個別変更できる。

### 6.4 重複判定

以下を正規化して候補を表示する。

- 電話番号
- メールアドレス
- 氏名＋生年月日
- 同一LINE user ID

自動統合は行わず、運営が「同一人物として統合」「別人」「確認保留」を選ぶ。

## 7. CSV取込仕様

### 7.1 必須列

| CSV列 | 内容 |
|---|---|
| external_id | 外部申込側の一意ID |
| full_name | 氏名 |
| phone | 電話番号 |
| email | メールアドレス |
| birth_date | YYYY-MM-DD |
| participant_category | 参加区分 |
| application_status | confirmed等 |

`phone` または `email` のどちらかを必須とする。

### 7.2 任意列

- full_name_kana
- nickname
- residence_area
- notes
- applied_at
- consent_confirmed_at

### 7.3 取込手順

1. UTF-8 CSVをアップロード
2. ヘッダーを自動判定または手動マッピング
3. 検証結果を、正常・警告・エラーに分類
4. 重複候補を表示
5. 確認後に本取込
6. 取込結果と原本を保存

行単位でエラー内容を返し、正常行だけを取込む「部分取込」と、1件でもエラーがあれば全件中止する「全件検証」を選択可能にする。初期値は全件検証。

### 7.4 更新方式

- `external_id + event_id` を一意キーとする
- 再取込時は差分プレビューを出す
- LINE連携済み参加者の氏名・連絡先上書きは警告
- 希望・結果・受付データはCSVで上書きしない

## 8. Dream・感情カード仕様

### 8.1 夢登録必須イベント

- Dream No.がない参加者は、Passport発行前に夢登録を行う
- 公開範囲は必ず本人が選択
- 非公開を選択してもPassportを発行できる
- 9999人夢応援プロジェクトへの参加は別チェックボックス

### 8.2 夢登録任意イベント

- 「夢を登録する」「今回は登録せず進む」を表示
- スキップしてもPassportを発行できる
- Passportの夢欄には「未登録」ではなく欄自体を表示しない
- 後からPassportホームで登録できる

### 8.3 Dream No.

- 内部主キーと表示番号を分ける
- 表示番号は推測されても本人情報を取得できない設計
- 重複禁止
- 番号検索には追加本人確認を要求

### 8.4 AI文章生成

- 入力：選択カード、3問回答、自由記述、夢候補の目的
- 出力：橋渡し文220文字以内、夢候補3件
- 禁止：診断、性格断定、相性断定、治療助言、差別的表現
- 本人が選択または編集して確定するまで夢として保存しない
- 10秒でタイムアウトし固定テンプレートへ切り替える
- AIへの入力から氏名、電話、メール、生年月日を除外する

## 9. Love Passport・受付

### 9.1 Passport状態

`not_issued → issued → ready → checked_in → preference_submitted → result_available → completed`

- `issued`：Passport作成済み
- `ready`：必須設定に応じ、夢登録・5問回答等が完了
- `checked_in`：当日受付済み

### 9.2 QR

- QRには氏名、Dream No.、参加者番号を直接含めない
- 128bit以上のランダムトークンまたは署名付き短期トークン
- QR再発行時は旧トークンを失効
- 読取後、スタッフ画面に氏名、参加者番号、確認状態を表示
- 受付確定はスタッフ操作とし、読取りだけで自動確定しない

### 9.3 手動受付

- 参加者番号の前方一致、または氏名の部分一致で検索
- 検索候補は同一テナント・同一イベントの最大20件に限定し、参加者番号、氏名、参加状態、受付状態だけを表示
- 候補選択後にスタッフ確認画面を挟み、検索だけで受付確定しない
- 二重受付を警告
- 受付取消は理由必須
- すべて `checkin_logs` と監査ログへ保存

## 10. 席案内5問・配置計算

### 10.1 配点

| 軸 | 重み |
|---|---:|
| 価値観の近さ | 40 |
| 婚活への温度感 | 25 |
| 関係を育てるペース | 15 |
| 会話スタイルの補完性 | 10 |
| 興味テーマの共通性 | 10 |

### 10.2 計算方式

- 価値観：選択集合のJaccard類似度
- 温度感：管理画面で定義した順序尺度の距離
- ペース：順序尺度＋「相手に合わせたい」補正
- 会話スタイル：補完性マトリクス
- 興味テーマ：共通選択数
- 「答えたくない」の軸を除外し、残りの重みを100に正規化

### 10.3 ハード制約

- イベントの組合せ対象
- 受付済み／参加予定者
- 接触回避設定
- 同行者・既知関係の除外
- 1席1名
- テーブル定員

### 10.4 ソフト制約

- 合計スコア最大化
- 候補の偏り抑制
- 共通会話テーマが1件以上
- 過去の同席履歴がある場合は重複抑制

### 10.5 運営操作

1. 対象者と制約を確認
2. 配置案を生成
3. 警告を確認
4. 席をロック、入替、未配置化
5. 再計算
6. プレビュー
7. 運営責任者が確定・公開

配置計算は決定論的なルールベース処理を基本とし、生成AIに席を直接決めさせない。生成AIは参加者向けの説明文候補にのみ利用可能とする。

## 11. 希望入力・結果確定

### 11.1 共通仕様

- 受付済みかつ会話対象として登録された参加者だけを候補表示
- 自分自身、欠席者、接触回避対象を表示しない
- 「今回は選ばない」を許可
- 締切までは変更可能
- 相手へ一方希望、順位、自由メモを公開しない

### 11.2 最大2名・順位なし

- 0〜2名を選択
- 双方の選択に含まれる組を相互希望候補とする

### 11.3 第1希望のみ

- 0〜1名を選択
- お互いが第1希望の場合だけ相互希望候補とする

### 11.4 順位付き最大3名

- 0〜3名を重複なしで順位付け
- 相互に1〜3位以内へ選択していれば候補とする
- 候補一覧に双方の順位を運営限定で表示
- 自動確定はしない

### 11.5 結果確定

- 候補状態：`candidate → approved / declined / pending`
- 運営責任者が確定
- 複数成立を許可するかはイベント設定で選択
- 1名1成立に限定する場合、競合候補を警告し手動解決
- 結果確定後に通知プレビュー
- 一括通知前に対象人数と成立数を再確認
- 確定取消はシステム管理者権限、理由必須

## 12. データベース設計

### 12.1 共通

全テーブルに原則として以下を持たせる。

- `id` UUID
- `tenant_id` UUID
- `created_at`
- `updated_at`
- 必要に応じ `deleted_at`

### 12.2 主要テーブル

#### tenants

- name
- status
- timezone

#### tenant_modules

- tenant_id
- module_key
- enabled
- starts_at
- ends_at

#### users

- user_type：participant / staff
- status
- last_login_at

#### user_identities

- user_id
- provider：line / email
- provider_user_id
- verified_at
- unique(provider, provider_user_id)

#### staff_roles

- user_id
- role：reception / operator / manager / system_admin
- event_id nullable

#### events

- name
- status
- starts_at / ends_at
- venue_name / venue_address
- capacity
- dream_registration_mode
- preference_mode
- allow_multiple_matches
- preference_opens_at / closes_at
- result_publish_at
- settings_json

#### event_form_fields

- event_id
- field_key
- label
- field_type
- requirement：required / optional / hidden
- display_order
- validation_json

#### applications

- event_id
- source：shime_form / csv
- external_id nullable
- status
- full_name / full_name_kana
- phone_normalized
- email_normalized
- birth_date
- nickname
- residence_area
- participant_category
- submitted_at
- unique(event_id, external_id) where external_id is not null

#### application_imports

- event_id
- original_file_key
- status
- total_rows / success_rows / warning_rows / error_rows
- mapping_json
- imported_by

#### participants

- event_id
- application_id
- user_id nullable
- participant_number
- category
- status：invited / confirmed / cancelled / absent / attended
- link_token_hash
- link_token_expires_at
- unique(event_id, participant_number)

#### dream_profiles

- user_id
- dream_no
- dream_text
- visibility：nickname_and_dream / dream_only / private
- project_opt_in
- project_opt_in_at
- unique(dream_no)

#### emotion_cards

- card_set_id
- name
- image_key
- description
- active

#### emotion_selections

- participant_id
- emotion_card_id
- first_impression
- related_area
- underlying_wish
- free_text
- selected_at

#### questionnaires / questionnaire_versions / questionnaire_answers

- テンプレート、版、質問、選択肢、回答を分離
- イベント開始後は利用中バージョンを編集不可

#### love_passports

- participant_id
- status
- qr_token_hash
- issued_at
- ready_at
- qr_expires_at nullable

#### event_tables / event_seats

- event_id
- table_code
- seat_code
- capacityまたは1席単位

#### resource_templates

- tenant_id
- module_key
- template_type
- template_key
- name
- version / schema_version
- payload_json
- active
- created_by

会場レイアウト、フォーム、通知文などを格納できる共通の版付きテンプレート基盤とする。イベントはテンプレートを直接参照して運用せず、選択時点の内容をイベント固有テーブルまたは設定スナップショットへコピーする。

#### resource_template_applications

- tenant_id
- module_key / template_type
- template_id / template_version
- target_type / target_id
- applied_snapshot_json / snapshot_hash
- applied_by / applied_at

テンプレートを対象実体へ保存した時点の不変な適用履歴とする。コピー選択だけでは記録せず、対象の保存が成功したトランザクション内で記録する。テンプレートのアーカイブ後も履歴とスナップショットを保持する。

#### seating_runs

- event_id
- algorithm_version
- config_snapshot_json
- target_snapshot_json
- status
- score_summary_json
- created_by

#### seat_assignments

- seating_run_id
- participant_id
- seat_id
- score nullable
- explanation_json
- locked
- published_at nullable

#### checkins

- participant_id
- status
- checked_in_at
- checked_in_by
- method：qr / manual

#### conversation_pairs

- event_id
- participant_a_id
- participant_b_id
- round_no nullable
- 実際に会話した相手の候補制御に利用

#### preferences

- event_id
- from_participant_id
- to_participant_id
- rank nullable
- submitted_at
- unique(event_id, from_participant_id, to_participant_id)

#### match_candidates

- event_id
- participant_a_id
- participant_b_id
- a_rank / b_rank nullable
- status
- decided_by / decided_at
- decision_reason nullable

#### notifications

- event_id
- user_id
- type
- channel
- status
- scheduled_at / sent_at
- payload_snapshot_json
- error_code / error_message

#### consents

- user_id
- event_id nullable
- consent_type
- document_version
- accepted
- accepted_at
- ip_hash nullable

#### audit_logs

- actor_user_id
- event_id nullable
- action
- target_type / target_id
- before_json / after_json
- reason nullable
- created_at

## 13. API仕様

### 13.1 公開申込み

- `GET /api/public/events/:eventId`
- `GET /api/public/events/:eventId/form`
- `POST /api/public/events/:eventId/applications`
- `POST /api/public/events/:eventId/applications/validate`

### 13.2 LIFF認証・参加者

- `POST /api/liff/session`
- `POST /api/liff/applications/link`
- `GET /api/liff/me/events/:eventId`
- `GET /api/liff/me/passport/:eventId`

### 13.3 Dream・感情カード

- `GET /api/liff/events/:eventId/emotion-cards`
- `POST /api/liff/events/:eventId/emotion-selection`
- `POST /api/liff/events/:eventId/dream/suggestions`
- `PUT /api/liff/me/dream`
- `POST /api/liff/me/dream/skip`

### 13.4 Passport・質問

- `POST /api/liff/events/:eventId/passport`
- `GET /api/liff/events/:eventId/questionnaire`
- `PUT /api/liff/events/:eventId/questionnaire/answers`
- `POST /api/liff/events/:eventId/questionnaire/submit`

### 13.5 席・希望・結果

- `GET /api/liff/events/:eventId/seat`
- `GET /api/liff/events/:eventId/preference-options`
- `PUT /api/liff/events/:eventId/preferences`
- `POST /api/liff/events/:eventId/preferences/submit`
- `GET /api/liff/events/:eventId/result`

### 13.6 管理API

- `POST /api/admin/events/:eventId/imports`
- `GET /api/admin/events/:eventId/imports/:importId`
- `POST /api/admin/events/:eventId/imports/:importId/commit`
- `GET /api/admin/events/:eventId/participants`
- `POST /api/admin/events/:eventId/checkins/scan`
- `POST /api/admin/events/:eventId/checkins/manual`
- `POST /api/admin/events/:eventId/seating-runs`
- `PATCH /api/admin/events/:eventId/seating-runs/:runId/assignments`
- `POST /api/admin/events/:eventId/seating-runs/:runId/publish`
- `GET /api/admin/events/:eventId/match-candidates`
- `PATCH /api/admin/events/:eventId/match-candidates/:candidateId`
- `POST /api/admin/events/:eventId/results/confirm`
- `POST /api/admin/events/:eventId/notifications/preview`
- `POST /api/admin/events/:eventId/notifications/send`

### 13.7 API共通ルール

- JSON形式
- 管理APIはロール・イベント権限を毎回検証
- 変更APIはCSRF対策または同等の保護
- `Idempotency-Key` を申込み、受付、結果通知等で利用
- エラー形式：`code`, `message`, `field_errors`, `request_id`
- 一覧APIはページネーション
- 個人情報をレスポンスへ出し過ぎない

## 14. 管理画面

### 14.1 ダッシュボード

- 申込者
- LINE連携
- Dream確認・発行
- Passport発行
- 5問回答
- 受付
- 希望入力
- 結果確定
- 要対応一覧

### 14.2 イベント作成・設定

- 基本情報
- 申込フォーム項目
- 夢登録方式
- 希望入力方式
- 複数成立許可
- 席・テーブル
- カードセット
- 質問テンプレート
- 通知日時・文面
- スタッフ権限

設定変更時に「現在の参加者・回答・結果への影響」を表示する。希望入力開始後は希望方式を変更不可とする。

### 14.3 参加者管理

- 一覧、検索、絞込
- 申込元表示
- 重複候補
- LINE紐づけ
- Dream状態
- Passport状態
- 受付、席、希望、結果
- CSV出力

### 14.4 席配置

- 対象者確認
- 制約警告
- 配置案生成
- ドラッグ入替
- 席ロック
- 再計算
- 確定・公開

### 14.5 希望・結果

- 希望入力開始・締切
- 未入力者
- 双方希望候補
- 順位表示（順位方式のみ）
- 競合警告
- 承認・非承認・保留
- 結果確定
- 通知プレビュー・送信

## 15. 権限

| 操作 | 受付 | 運営 | 責任者 | システム管理者 |
|---|---:|---:|---:|---:|
| QR・手動受付 | ○ | ○ | ○ | ○ |
| 参加者基本情報閲覧 | 最小限 | ○ | ○ | ○ |
| 感情・夢回答閲覧 | × | 必要時のみ | ○ | ○ |
| CSV取込 | × | ○ | ○ | ○ |
| 席案作成・編集 | × | ○ | ○ | ○ |
| 席確定・公開 | × | × | ○ | ○ |
| 希望内容閲覧 | × | 制限可 | ○ | ○ |
| 結果確定 | × | × | ○ | ○ |
| 確定結果の取消 | × | × | × | ○ |
| イベント設定変更 | × | × | ○ | ○ |

## 16. セキュリティ・個人情報

- テナント・イベント境界を全クエリで強制
- 個人情報は必要最小限の取得・表示
- 通信はHTTPS
- 管理者認証に多要素認証を推奨
- LINEトークン、APIキーをブラウザ・ログへ露出しない
- 電話・メールは正規化値と表示値を分け、必要に応じ暗号化
- QR、link tokenはハッシュで保存
- CSV原本へのアクセスを権限管理
- 本番データを開発・検証環境へコピーしない
- 監査ログを一般運営者が削除できない
- 保存期間と削除手順を主催者が規約へ明記
- 夢公開同意と婚活イベント利用同意を分離

## 17. AI障害時の継続運用

| AI機能 | 通常 | 障害時 |
|---|---|---|
| 感情から夢への橋渡し | AI短文 | 選択回答を差し込む固定文 |
| 夢候補3件 | AI生成 | 選択肢別の定型候補 |
| 席案内理由 | AI整文可 | 上位2軸の固定文 |
| 席配置 | ルールベース | 同じルールベース |
| 結果判定 | ルールベース＋運営 | 同じ運用 |

AI障害を理由に受付、席配置、希望入力、結果確定を停止しない。

## 18. 非機能要件

- 参加者画面：幅320〜430pxを重点対応
- タップ領域：44px以上
- 通常API：95パーセンタイル2秒以内を目標
- QR受付：通常3秒以内
- AI：10秒でタイムアウト
- 参加者50名を最低基準とし、200名で性能試験
- 同時受付端末5台以上
- DBバックアップ毎日。本番前日に復旧確認
- 重要処理にrequest_idを付与
- エラー監視とLINE通知失敗監視
- 日本時間表示、DBはUTC保存

## 19. 受入テスト

### 19.1 申込み

- SHIMEフォームから申込みできる
- 必須・任意・非表示設定が反映される
- CSVの正常、警告、エラー行を判定できる
- 再取込差分と重複候補を確認できる

### 19.2 LINE・本人紐づけ

- 正しいトークンで紐づく
- 期限切れ、再利用、別アカウントを拒否する
- 再発行と管理者再紐づけが記録される

### 19.3 夢登録

- 必須イベントでは夢確定前にPassport発行できない
- 非公開でも発行できる
- 任意イベントではスキップできる
- プロジェクト参加同意を別管理できる

### 19.4 Passport・受付

- QRに個人情報が含まれない
- QR・手動受付が動く
- 二重受付を警告する
- 取消理由と履歴が残る

### 19.5 席配置

- 5問の回答を採点できる
- 未回答軸の重みを正規化する
- 欠席・接触回避・席定員を守る
- 手動変更・ロック・再計算が動く
- 責任者確定後だけ参加者へ表示される

### 19.6 希望・結果

- 3方式それぞれで人数・順位制限が正しい
- 締切後は変更できない
- 双方希望候補が正しい
- 一方希望を参加者へ表示しない
- 責任者確定前に通知されない
- 複数成立設定と競合警告が正しい

### 19.7 障害

- AI停止中も全主要導線を完了できる
- LINE送信失敗を検知・再送できる
- QR不調時に手動受付できる
- CSVと紙の席表で代替運用できる

## 20. 開発順序

### フェーズ1：基盤

- 認証、テナント、イベント、権限、監査
- イベント設定
- PostgreSQLスキーマ

### フェーズ2：申込み・LINE

- SHIME申込フォーム
- CSV取込
- LIFF認証、申込み紐づけ
- 通知基盤

### フェーズ3：Dream・Passport

- 感情カード
- 夢登録必須／任意
- Dream No.
- Passport、QR受付

### フェーズ4：席案内

- 5問
- 採点
- 席配置案
- 手動調整、確定、公開

### フェーズ5：希望・結果

- 3方式
- 双方希望候補
- 運営確定
- 結果通知

### フェーズ6：本番準備

- 総合テスト
- データ取込リハーサル
- 会場受付リハーサル
- 障害訓練
- 機能凍結

## 21. 8月8日までの優先度

### P0：本番必須

- イベント設定
- CSV取込
- LIFF認証・紐づけ
- 夢登録方式切替
- 感情カード
- Passport
- 5問
- QR・手動受付
- 席配置・確定
- 希望3方式
- 結果確定・通知
- CSVバックアップ

### P1：できれば本番前

- SHIME申込フォームの項目カスタマイズ
- 通知予約
- 重複統合支援
- 席ドラッグ操作

### P2：8月8日以降でも可

- 高度な分析
- 複数イベントの横断分析
- 独自テンプレート販売画面
- 課金・契約管理
- OEMブランド設定

## 22. 開発着手前の最終入力値

機能仕様は本書で固定する。以下はイベント固有データとして管理画面へ登録する。

1. 正式イベント名、日時、会場
2. 定員と参加区分
3. テーブル数・席番号
4. 席替え回数と進行
5. 採用する夢登録方式
6. 採用する希望入力方式
7. 複数成立の可否
8. 成立後の連絡方法
9. 感情カード画像・名称
10. 申込フォームの正式項目
11. CSV実データの列名
12. 利用規約、プライバシーポリシー、各同意文面
13. LINE公式アカウント・LIFFチャネル
14. 運営スタッフと権限

## 23. 仕様凍結ルール

- 本書を開発仕様v2.0とする
- 画面文言・画像差替えは機能変更と分ける
- DB変更、API追加、状態遷移変更は責任者承認を必須にする
- 総合テスト開始後はP0の重大不具合以外の変更を次回版へ送る
- 本番1週間前から設定値変更にも変更履歴を残す

## 24. 公式仕様に基づく実装注意

- LIFFからサーバーへ本人情報を渡す際は、クライアントでデコードした情報ではなく、生のIDトークンまたはアクセストークンをサーバーへ送り検証する
- LINE Webhookは署名検証を必須にする
- LINE通知はMessaging APIのpush等を用い、送信結果を履歴化する
- LIFFはLINE内ブラウザだけでなく外部ブラウザで開く場合も考慮し、通常Web表示でも破綻しないようにする

