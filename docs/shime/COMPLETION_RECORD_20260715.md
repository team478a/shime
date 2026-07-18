# SHIME 開発・設定完了記録

- 記録日: 2026-07-15
- 本番予定日: 2026-08-08
- 対象: SHIME婚活イベントシステム
- 検証環境: `https://shime-staging.vercel.app`
- 現在判定: **システムのP0主要機能は実装済み。ただし、正式イベント設定と実機総合試験が残っているため本番可判定ではない**

## 1. この記録の目的

これまでに実施したリポジトリ調査、実装、Supabase設定、LINE・LIFF設定、Vercelデプロイ、テスト、リハーサル準備を一つにまとめる。

この文書にはパスワード、APIキー、LINEトークン、本人連携トークン、参加者の個人情報は記載しない。

## 2. 採用技術と実行環境

| 領域 | 採用内容 |
|---|---|
| Web | Next.js 16 / React 19 / TypeScript strict |
| API | Next.js Route Handlers |
| DB | Supabase PostgreSQL |
| ORM / Migration | Drizzle ORM / Drizzle Kit |
| 入力検証 | Zod |
| LINE | LINE Login / LIFF / Messaging API |
| AI | OpenAI接続をプロバイダー境界の後ろに配置 |
| AI代替 | 固定文フォールバック |
| Hosting | Vercel staging |
| Test | Vitest / Playwright / PGlite |
| 時刻 | DB保存はUTC、表示はAsia/Tokyo |

## 3. フェーズ別完了記録

### Phase 0: リポジトリ調査・設計固定

- 仕様書、実装タスク、2026-08-08設定YAML、CSV雛形を確認。
- Next.js、TypeScript、Drizzle、Supabase、LINE LIFF、Vercelを中心とする構成に固定。
- テナント・イベント境界、権限、監査、プロバイダー分離、AIフォールバックを実装原則として固定。

### Phase 1: 基盤・認証・イベント設定

- pnpm workspace構成、TypeScript strict、ESLint、Vitest、Playwright、CIを追加。
- 必須環境変数の起動時検証を追加。
- スタッフID・パスワード認証、セッション管理、ログイン制限を実装。
- `reception` / `operator` / `manager` / `system_admin` の4権限を実装。
- イベント作成、編集、状態遷移、設定不足チェック、受付開始ガードを実装。
- 設定不足のまま `accepting` へ変更した場合は `CONFIGURATION_INCOMPLETE` で拒否することを確認。

### Phase 2: 申込み・CSV・重複判定

- SHIME公開申込フォームを実装。
- CSVプレビュー、マッピング、警告・エラー表示、コミットを実装。
- 電話番号、メール、氏名＋生年月日の重複候補を管理画面で判定可能にした。
- CSV再取込で受付、希望、結果データを上書きしない境界を維持。
- UTF-8 BOM、引用符、スプレッドシート数式インジェクション対策を確認。

### Phase 3: LINE・LIFF・本人連携

- LINE Loginチャネル、LIFFアプリ、Messaging API Webhook、公式アカウント連携を設定。
- IDトークンのサーバー検証、LINE identity、SHIMEセッションを実装。
- 72時間の推測困難な本人連携トークン、ハッシュ保存、一回限り利用、補助確認を実装。
- LIFF一次リダイレクトの `liff.state` と二次リダイレクトの直接クエリに対応。
- 管理者限定の参加者LINE連携状況画面と本人連携リンク再発行を実装。
- 再発行時は旧URLを失効し、生トークンをDB・監査ログへ保存しない。
- 同一スマートフォンでのLINE直接起動、別画面表示、URLコピーを追加。

### Phase 4: Dream・感情カード

- イベント別のDream必須／任意モードを実装。
- 感情カード表示、選択、引き直し制限、下書き、確定、スキップを実装。
- 自由記述原文や氏名をAIへ送らない境界を実装。
- OpenAI接続失敗、タイムアウト、形式不正時の固定文フォールバックを実装。
- 検証用に暫定感情カード8枚と固定文3候補を登録。

### Phase 5: Love Passport・QR・受付

- Love Passport発行、参加者番号、受付QR発行・再発行・失効を実装。
- QR内に氏名、連絡先、参加者番号、Dream No.を含めず、不透明トークンだけを格納。
- QR読取り後にスタッフ確認を挿み、読取りだけで受付確定しない。
- 参加者番号、氏名、電話番号下4桁による手動受付を実装。
- QRを480 px化し、別画面表示、画像保存、受付コードコピー、手動受付案内を追加。
- 重複受付拒否、取消理由、受付履歴、監査ログを実装。

### Phase 6: 席案内・席配置

- イベント別の5問設定、回答、確定、スコア計算を実装。
- 重みに基づく決定論的な初期席配置案を実装。
- 受付済み参加者だけを配置対象にし、欠席者の席を公開しない。
- テーブル・席マスター、手動修正、ロック、責任者確定後の公開を実装。
- 暫定席案内5問v1を登録。

### Phase 7: 希望・双方希望・結果通知

- `mutual_up_to_2` / `first_choice_only` / `ranked_up_to_3` の3方式を実装。
- 希望下書き、提出、再提出、締切制御を実装。
- 双方希望候補は決定論的ルールで抽出し、責任者が確定するまで非公開とした。
- 結果確定・取消、通知プレビュー、人数再確認、通知キュー、再送を実装。
- 一方的な希望、順位、私的メモ、感情回答を他参加者へ表示しない。

### Phase 8: 管理・運用・本番準備

- 管理者・権限追加編集、安全条件付きイベント削除、申込項目編集を実装。
- LINE、OpenAI、独自ドメイン、監視、通知ジョブ、通知テンプレートの管理画面を実装。
- LINE・OpenAIの秘密値はAES-256-GCMで暗号化し、保存後は再表示しない。
- イベント規約・プライバシーポリシーの下書き、版管理、公開、過去版保存、公開ページを実装。
- 設定版と一致する公開済み規約2種類が揃うまで受付開始を拒否。
- health / readiness / 監視ジョブ / 通知ジョブを追加。
- 日次バックアップ、論理バックアップ、ローカル復元、非本番Supabase復元、private Storage復元を検証。

## 4. 現在の2026-08-08イベント状況

### Stagingイベント

- イベントコード: `shime-20260808`
- 状態: `draft`
- 開始: 2026-08-08 14:00 JST
- 定員: 50名
- Dream方式: `required_private_allowed`
- 希望方式: `mutual_up_to_2`
- 複数成立: 無効
- 連絡先交換: 運営仲介
- 標準申込項目: 8件登録済み
- 感情カード: 暫定8枚
- 席案内5問: 暫定v1
- 正式設定完了まで `accepting` へ変更不可

### 主催者確定待ち

1. 正式イベント名
2. 終了日時
3. 会場名・会場住所
4. 受付開始・終了日時
5. 希望入力開始・締切日時
6. 参加区分A/Bの正式名称
7. 席替え回数
8. データ保存日数
9. イベント規約本文・版
10. プライバシーポリシー本文・版
11. テーブルと50名分の有効席
12. 暫定感情カード、Dream固定文、5問の内容承認

## 5. Supabase完了記録

- Supabase PostgreSQLの検証環境を構築。
- ランタイム接続とマイグレーション接続を分離。
- `.env`とVercel Sensitive環境変数を設定。ファイルと値はGit管理対象外。
- Drizzle migration `0000` から `0009` まで作成・適用。
- 最新マイグレーションで規約文書の版管理テーブルを追加。
- Supabase Data APIの公開スキーマを制限。
- 日次physical backupとリポジトリ外logical backupを確認。
- ローカルと非本番プロジェクトへの復元試験を実施。
- 復元用一時プロジェクトは検証後に削除。

## 6. LINE・OpenAI・外部接続完了記録

### LINE

- LINE Loginチャネル作成済み。
- LIFFアプリ作成・Endpoint設定済み。
- Messaging API Webhook登録済み。
- 公式アカウント連携済み。
- Webhook正署名 200、不正署名 401を確認。
- Bot Info API 200を確認。
- 設定値は管理画面から更新可能。

### OpenAI

- 管理画面から接続設定と有効／無効の切り替えが可能。
- Models API 200と接続状態 `healthy` を確認。
- 匿名合成入力でDream候補文を生成するスモークテストを実施。
- AI接続はDream文案作成だけに限定し、無効化または障害時も固定文で継続可能。

## 7. Vercelデプロイ記録

| 内容 | Deployment ID |
|---|---|
| LINE Messaging API更新 | `dpl_J16vdxyLeaAzjdXaBPu8gYf4RhjJ` |
| OpenAI出力形式修正 | `dpl_9xwiv56uJYmwdQfcxwaTV8bcarsH` |
| 2026-08-08下書き・受付開始ガード | `dpl_unhzrSWx5zbQHNaJZ4DD1JiD6TaM` |
| Dream・カードセット同期 | `dpl_3UrgWAcTJvzJ7E4dfTJXqmV6wfwp` |
| 設定チェック画面 | `dpl_8qiaMxt5Yp9qUR24FqW2GFB9nDd9` |
| 管理機能拡張第1弾 | `dpl_9AMRgyZbQPD7hVasByCSJ2urngTr` |
| LINE管理設定の実行時反映 | `dpl_GL5jjSg2Ctw7c1Cbs4wdXoNkyZWp` |
| LIFF `liff.state` 対応 | `dpl_DkNth5zoHtivgQykKRUrQFypdy92` |
| 規約・プライバシー管理 | `dpl_3u11RZ7PfbpAJRYpFMLv4dBNsEWe` |
| スマートフォンQR代替導線 | `dpl_GFiwM6SHUgTRxe1bzUo4nC4SuFhq` |
| 参加者LINE連携リンク再発行 | `dpl_9QMZoQ6YZp3XJmNKzFfosUmQ8bSS` |

現在のaliasは `https://shime-staging.vercel.app` を維持している。

## 8. 検証・テス記録

### 最新実行結果

| チェック | 結果 |
|---|---|
| `pnpm lint` | 成功 |
| `pnpm typecheck` | 成功 |
| `pnpm test:unit` | 23ファイル / 90件成功 |
| `pnpm test:integration` | 1ファイル / 2件成功 |
| `pnpm build` | 成功 |

### その他の確認

- Chromiumでデスクトップとスマートフォン幅のスモーク試験を実施。
- 参加者主要画面の320〜430 px幅で横スクロールが発生しないことを確認。
- 公開health 200、認証付きreadiness 200を確認。
- 未認証管理API・ジョブAPI・LIFF APIが401または適切なリダイレクトになることを確認。
- 未公開規約ページが404になることを確認。
- リハーサル用の隔離イベントと合成申込1件を準備。本番個人情報は使用していない。

## 9. 安全・プライバシー対応

- 全ての主要データクエリにテナント・イベント条件を付与。
- パスワード、APIキー、LINEトークン、生の本人連携トークンをログへ出力しない。
- `.env`と認証情報をGitへ登録しない。
- 本番個人情報を開発フィクスチャへ使用しない。
- 一方的な希望、順位、私的Dream、感情回答を他参加者へ表示しない。
- 席と結果は責任者確定後だけ公開。
- QRに個人情報を含めない。
- 公開済み規約は不変とし、修正は新版で行う。
- AIは文案作成に限定し、席配置と双方希望はルールベースで実行。

## 10. 未完了項目

### P0: 本番前に必須

1. `EVENT_CONFIG_20260808.yaml` の `REQUIRED_INPUT` を主催者の正式値で更新。
2. イベント規約とプライバシーポリシーの正式文面を登録・公開。
3. 50名分のテーブル・有効席を登録。
4. スマートフォン実機でLINE Login IDトークン検証から本人連携完了までを確認。
5. LINE Messaging APIの実通知送信・失敗・再送を確認。
6. Dream必須／任意、QR／手動受付、欠席後再配置、希望3方式、結果通知の認証済み全導線E2Eを実施。
7. Vercel Proまたは外部スケジューラで通知5分・監視10分の定期実行を構成。
8. 独自ドメイン、DNS、TLS、監視・アラートを本番構成。
9. stagingから本番への昇格手順を実施し、同じマイグレーションと環境変数を確認。
10. 現在の大量の未コミット・未追跡変更を確認し、秘密値を含まないことを再確認してコミットまたはPull Requestで保全。

### P1: リハーサル・耐障害性

- 匿名化50名の本番相当リハーサル。
- 200名負荷試験と受付端末5台の同時試験。
- LINE通知失敗・再送試験。
- CSV、紙受付、紙席表の代替運用訓練。
- 管理者MFAの採用判断。

### P2: 本番後でも可能な改善

- 質問票の構造化GUIエディター。
- 席配置のドラッグ操作。
- 高度な運用分析表示。

## 11. 次に実施する順序

1. スマートフォンでリハーサル参加者のLINE本人連携を完了する。
2. 主催者が2026-08-08の正式設定値と規約文面を確定する。
3. 正式値を管理画面へ登録し、設定チェックをゼロにする。
4. 匿名50名で、申込みから結果通知までの全導線をリハーサルする。
5. 独自ドメイン、高頻度ジョブ、監視、アラートを本番構成する。
6. Git履歴とデプロイ差分を固定し、本番昇格判定を行う。

## 12. 関連文書

- `CODEX_DEVELOPMENT_GUIDE_V1.md`
- `DEVELOPMENT_SPEC_V2.md`
- `IMPLEMENTATION_TASKS_V1.md`
- `EVENT_CONFIG_20260808.yaml`
- `EVENT_CONFIG_STATUS_20260808.md`
- `PHASE8_READINESS_REPORT.md`
- `PHASE8_REHEARSAL_CHECKLIST.md`
- `SUPABASE_SETUP.md`
- `SUPABASE_BACKUP_RECOVERY.md`
- `VERCEL_DEPLOYMENT.md`
- `VERCEL_SECURITY_OPERATIONS.md`
- `PLATFORM_OPERATIONS.md`
- `LEGAL_DOCUMENT_OPERATIONS.md`
- `PHASE3_LINE_SETUP.md`
- `PHASE5_CHECKIN_OPERATIONS.md`

## 13. 結論

アプリケーション基盤、申込み、LINE連携、Dream、Passport、受付、席配置、希望・結果、管理、規約、監視、バックアップの主要基盤は実装・検証環境反映済みである。

一方、2026-08-08本番を可とするには、正式設定の確定、実機LINE本人連携、匿名50名リハーサル、通知・定期ジョブ・監視の本番構成、Gitでの変更保全が必要である。
