# SHIME production隔離UAT 実施記録

実施日: 2026-07-31  
環境: production（独自ドメイン `https://app.shimelife.jp`）  
対象: 隔離tenant `shime-uat` / UAT専用イベント  
判定: **部分合格。本番Go判定ではない**

## 安全条件

- UAT専用tenant、UAT専用イベント、合成参加者だけを使用した。
- 実参加者データ、本番通知、外部AI生成は使用していない。
- LINEの秘密値、本人連携token、管理者パスワード、個人情報は本記録へ保存していない。
- 席公開はUAT専用イベント内だけで実施した。

## 確認できた導線

1. production管理画面へのログイン
2. イベント設定チェックと申込フォーム表示
3. 合成申込の受付
4. LINE Developers設定、LIFF起動、Webhook有効化
5. 管理画面のLINE接続テスト `healthy`
6. 本人連携リンク再発行とスマートフォンでのLINE本人連携
7. Dream入力、候補選択、登録
8. 席案内5問の回答と提出
9. SHIME PASS発行、参加者番号 `A01`、受付QR表示
10. スタッフによる手動受付と受付番号発行
11. 受付済み2名を対象とする席配置案の生成
12. カテゴリ不成立時の `CATEGORY_PAIR_CONFLICT` 防止
13. 異なるカテゴリの合成参加者2名を同一テーブルへ配置、ロック、保存、公開
14. 公開済み配置がDB上で2件存在すること

## UAT中に発見した不足と修正

公開済みの席配置は保存されていたが、参加者のSHIME PASSにテーブル・席番号を表示するUIがなかった。

次を追加した。

- 参加者本人の公開済み席だけを取得するSeating Repository / UseCase
- tenant、event、participant、公開済みrunをすべて条件に含む取得
- API Routeからの直接Drizzleアクセス除去
- SHIME PASSの「現在の席」表示
- 未公開・未配置時の「席案内は準備中」表示
- スマートフォン向け「席案内を更新」操作
- 他参加者の席を返さないAPI契約テスト
- モバイル・デスクトップのPASS席表示E2E

実装コミット:
`67fc36e8383ad449c116dfcd32ae336d9d39399a`

production deployment:
`dpl_3oxmU4iWmJ4VpsBjdDDwRYYip2s9`

公開後確認:

- Vercel deployment: `READY`
- 独自ドメインalias: `https://app.shimelife.jp`
- `/api/health`: HTTP 200
- 未認証の参加者席API: HTTP 401

## テスト結果

- `pnpm architecture:check`: 成功
- `pnpm lint`: 成功（error 0、既存warningのみ）
- `pnpm typecheck`: 成功
- `pnpm test`: 成功（単体312件、結合37件）
- `pnpm build`: 成功
- 新規PASS席表示E2E: モバイル2件・デスクトップ2件成功
- `pnpm test:e2e`: 37件成功、4件意図的skip、既存マニュアル試験1件が初回のみタイミング失敗
- 失敗した既存マニュアル試験の単独再実行: 3件成功
- 変更対象14ファイルのPrettier: 成功
- リポジトリ全体の`pnpm format:check`: 今回未変更の48ファイルにあるWindows CRLF差で失敗
- `git diff --check`: 成功

## 未確認・残作業

- 修正後の実機で、A01本人のPASSに公開済み `T01 / T01-1` が表示されること
- SHIME診断のproduction隔離UAT
- 希望入力、成立判定、manager確定、結果閲覧の一連
- 通知のpreview、失敗、再試行、二重送信防止（実通知は明示承認まで禁止）
- 匿名化50名、受付端末5台を用いた本番相当リハーサル
- バックアップからの復旧訓練と紙運用への切替訓練
- 高頻度定期ジョブ、監視、障害通知の確認
- `EVENT_CONFIG_20260808.yaml`の`REQUIRED_INPUT` 15項目の正式確定

上記P0が残るため、この記録単独では2026-08-08イベントの本番Goとは判定しない。
