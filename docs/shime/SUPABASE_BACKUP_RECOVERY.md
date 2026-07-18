# Supabaseバックアップ・復旧手順

## 方針

- DBとSupabase Storageの実ファイルは別々に保全する。DBバックアップはStorageのメタデータを含むが、実ファイル自体は含まない。
- 復元テストは必ず新規の非本番Supabaseプロジェクトで行う。
- バックアップファイルは個人情報と認証情報を含む機密データとして扱う。リポジトリ、共有フォルダ、チャットに保存しない。
- 本番復元はサービス停止を伴うため、責任者承認と復旧時点の確認なしに実行しない。

## 1. Dashboardでバックアップ方式を確認

Supabase Dashboardの `Database > Backups` を開き、次のいずれかを確定する。

- `manual`: Free等。CLIで毎日ロジカルバックアップを取得する。
- `daily`: Dashboardの毎日バックアップを利用し、加えてイベント前にロジカルバックアップを取得する。
- `pitr`: PITRを利用し、加えてイベント前にロジカルバックアップを取得する。

確認後、ローカル `.env` の `SUPABASE_BACKUP_MODE` だけを更新する。

## 2. 事前点検

```powershell
pnpm supabase:backup-readiness
```

このコマンドは秘密値やStorageオブジェクト名を出力しない。次のみを確認する。

- DBマイグレーション数
- public table数
- private bucketの存在と公開状態
- Storageオブジェクト数
- Supabase CLI、Docker Desktopの利用可否

## 3. ロジカルバックアップ

Docker Desktopをインストール・起動し、Supabase CLIを使う。出力先には、リポジトリ外の暗号化されたフォルダを指定する。

```powershell
$backup = "D:\SHIME-secure-backups\2026-08-07"
New-Item -ItemType Directory -Force -Path $backup
pnpm dlx supabase db dump --db-url $env:DATABASE_MIGRATION_URL -f "$backup\roles.sql" --role-only
pnpm dlx supabase db dump --db-url $env:DATABASE_MIGRATION_URL -f "$backup\schema.sql"
pnpm dlx supabase db dump --db-url $env:DATABASE_MIGRATION_URL -f "$backup\data.sql" --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

作成後、3ファイルが0 byteでないこと、読み取り権限が運営責任者だけに限定されていることを確認する。SQLの中身をチャットへ貼り付けない。

## 4. Storageバックアップ

`shime-private-imports` はprivateのまま維持する。オブジェクトが存在する場合は、Dashboardの `Storage > Configuration > S3` で専用S3資格情報を発行し、暗号化されたリポジトリ外フォルダへS3互換クライアントで同期する。資格情報は `.env` またはOSの資格情報ストアだけに保存し、Gitへ追加しない。

## 5. 別プロジェクトへの復旧リハーサル

1. `shime-recovery-rehearsal` などの新規非本番Supabaseプロジェクトを作る。
2. 元プロジェクトと同じ拡張、Webhook、Storage bucketを用意する。
3. 復旧先の接続文字列を `RECOVERY_DATABASE_URL` に設定する。
4. `psql --single-transaction --variable ON_ERROR_STOP=1` でroles、schema、dataの順に復旧する。
5. StorageファイルはStorage APIまたはS3互換エンドポイント経由で復元する。Storage tableをSQLで直接変更しない。
6. 復旧先で `pnpm supabase:verify`相当のテーブル数・マイグレーション数と、主要テーブルの件数を比較する。
7. 非本番復旧先でのみ、管理者ログインとサンプルデータの読取りを確認する。
8. 復旧開始・完了時刻、検証結果、手順差分をリハーサル記録に残す。

## 6. 本番前の必須タイミング

- 本番1週間前: 別プロジェクトへの復旧リハーサル完了
- 2026-08-07: DBとStorageの最終手動バックアップ
- 2026-08-08開場前: Dashboardの最新バックアップ時刻とジョブ失敗がないことを確認

## 7. 復旧リハーサル記録

### 2026-07-13 ローカル隔離環境

- 対象: staging Supabaseのロジカルバックアップ
- 保存先: リポジトリ外の運営者専用フォルダ（SQL本文・資格情報は記録しない）
- バックアップ: `roles.sql`、`schema.sql`、`data.sql` の3ファイルを作成し、0 byteでないこととSHA-256を確認
- 復旧先: Docker Desktop上の新規Supabaseローカル環境。本番・stagingへの書込みは実施していない
- 復旧方法: roles、schema、dataの順に、それぞれ単一トランザクションかつエラー時停止で適用
- 復旧結果: 3段階すべて終了コード0
- 整合性: 元DBと復旧先のpublic table数47、総行数16、Drizzle migration数8が一致
- 詳細照合: 全public tableのテーブル別行数マップを正規化してSHA-256比較し、一致
- Storage: DBバックアップに実ファイルが含まれないことを再確認。オブジェクトが投入された後は、別途Storage復旧試験が必要
- Storage事前試験: private bucketへ58 byteの匿名JSON fixtureを登録し、Storage APIでリポジトリ外へ保存後、別キーへ復元した。元データ・バックアップ・復元データのSHA-256一致を確認し、検証用オブジェクトだけを削除した
- Storage事前試験後: bucketがprivateのままで、検証前と同じオブジェクト0件へ戻ったことを確認
- 手順差分: 初回はクラウドではなくネットワーク隔離可能なローカルSupabaseを使用した。翌日のクラウド非本番復旧で差分を解消した
- 時間計測: 初回Dockerイメージ取得を含むため未計測。次回はイメージ取得完了後のDB復旧開始から計測する

### 2026-07-14 クラウド非本番環境

- 復旧先: 新規の非本番Supabaseプロジェクト。元プロジェクトとは別IDであることを実行前に検証
- 接続方式: DockerからDirect接続のIPv6へ到達できなかったため、Session Pooler（5432）を使用
- 復旧前確認: public table 0件
- DB復旧: roles、schema、dataの順に、単一トランザクションかつエラー時停止で適用。3段階すべて終了コード0
- DB整合性: 元DBと復旧先でpublic table数47、復旧時点の総行数16、Drizzle migration数8が一致
- 詳細照合: 全public tableのテーブル別行数マップを正規化してSHA-256比較し、一致
- Storage復旧: private bucketのメタデータを確認後、リポジトリ外に保全した58 byteの匿名JSON fixtureをStorage APIで復元
- Storage整合性: 復元先から再取得したオブジェクトのSHA-256がバックアップと一致。private設定を維持
- アプリ確認: 復元先DB・Storageを参照する一時ローカルサーバーで管理者ログイン200、管理イベントAPI 200、セッション失効を確認
- データ状態: 元DBにイベントレコードがないため、復元先のイベント一覧も0件
- リージョン差分: 元プロジェクトはソウル、復旧先は東京。論理バックアップの可搬性確認として許容
- 後処理: 一時ローカルサーバーを停止後、2026-07-14に責任者承認を得てクラウド復旧先プロジェクトを削除。照合記録とリポジトリ外バックアップのみを保持

### 2026-07-15 実機リハーサル直前バックアップ

- Dashboard確認: 最新physical backupは `2026-07-14 16:33:34 UTC`（`2026-07-15 01:33:34 JST`）
- 追加取得日時: `2026-07-15 21:12 JST`
- 対象: RH-A/B/C作成、合成申込12件、参加者12件、イベントマスター登録後のstaging DB
- 保存先: リポジトリ外の所有者限定フォルダ。SQL本文と絶対パスは共有記録へ含めない
- `roles.sql`: 5,370 bytes、SHA-256 `edb1d3813721ec0d8ebc9991fd11825951b9485d53a7509ba3229d1f88fc5744`
- `schema.sql`: 250,509 bytes、SHA-256 `f4f46b89a7ac2626061c812aa5b0fdb02351a791fe44c516b26eaee1dd5b73e6`
- `data.sql`: 135,571 bytes、SHA-256 `78ebd8481a1af1f606070f6e3285f68766996956f46ff39581bb45925ef347fe`
- 権限: Windowsファイル継承を解除し、所有者アカウントのフルコントロールだけを付与
- 手順差分: Direct接続のIPv6へDockerから到達できないため、前回復旧試験と同じPooler接続を使用。Supabase CLIのDocker連携ではなくPostgreSQL 17公式コンテナの`pg_dumpall`／`pg_dump`を直接使用
- Storage: DBバックアップはStorage実ファイルを含まない。private bucketとオブジェクト3件の存在は別途確認済み

## 本番復元の承認ゲート

次をすべて満たすまでDashboardのRestoreを実行しない。

- 障害原因と影響範囲を記録済み
- 責任者が復元時点と許容するデータ消失量を承認済み
- 参加者画面・管理画面の停止案内を準備済み
- 復旧後のDB・Storage・LINE・Vercel検証担当を確定済み
