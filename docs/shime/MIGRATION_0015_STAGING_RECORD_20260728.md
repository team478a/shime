# Migration 0015 staging実施記録

実施日: 2026-07-28
対象環境: Supabase staging / Vercel `shime-staging`
対象migration: `0015_strange_mandroid.sql`
実施者: Codex（ユーザー承認済みのstaging作業）
判定: **staging適用・検証成功**

## 対象リビジョン

- PR: `#3`（SHIME Concierge Phase 1B）
- release merge commit:
  `cef5ace36768b2af82e4dc47cdf91d250d9fbdc5`
- merge先: `release/2026-08-08-readiness`
- productionおよび`main`への反映: **未実施**

## 復旧点

リポジトリ外の安全な保存先へ、migration適用前のロジカルバックアップを作成した。
SQLの内容、接続情報、パスワード、個人情報は本記録へ掲載しない。

- バックアップ参照名: `staging-pre-0015-20260728-185625`
- 作成時刻: 2026-07-28 18:56:25 JST（2026-07-28 09:56:25 UTC）
- `roles.sql`
  - size: 5,370 bytes
  - SHA-256:
    `03aa8cbe744f0542e329a988797857aa699d4e89ba1972746a39732a9b2ba62a`
- `schema.sql`
  - size: 269,372 bytes
  - SHA-256:
    `b359e3f4ba61234094fc44a68af37b2cd2159ca628891a6ad64cbc70ce1abc9a`
- `data.sql`
  - size: 169,896 bytes
  - SHA-256:
    `409562e20687a33d928a25a9d7708f2cc0f658dbc55539e4a5e7812c969ed24a`
- 復旧手順:
  `docs/shime/SUPABASE_BACKUP_RECOVERY.md`を適用前に確認済み

## 適用前確認

`pnpm supabase:verify`:

- migration接続: 正常
- runtime接続: 正常
- runtimeとmigrationの接続先: 同一DB
- public tables: 60
- applied migrations: 15

`pnpm db:preflight:0015`:

- 読み取り専用セッション: `true`
- 現在のmigration head: `0014`（`1784935028909`）
- tenant/event scope検査: 11件すべて存在
- scope不整合集計: 11件すべて0
- 欠落制約・テーブル・scope検査: なし
- `safe`: `true`

## Migration適用

`pnpm db:migrate`を実行し、migration 0015の適用に成功した。
既存のDrizzle管理schema/tableおよびPostgreSQLの識別子切り詰めに関する通常notice以外の
エラーは発生していない。

## 適用後確認

`pnpm db:verify:0015`:

- 読み取り専用セッション: `true`
- migration head: `0015`（`1784965553645`）
- tenant/event scope不整合集計: 11件すべて0
- 欠落制約: なし
- 欠落テーブル: なし
- 欠落scope検査: なし
- `safe`: `true`

`pnpm supabase:verify` / `pnpm supabase:backup-readiness`:

- public tables: 65
- applied migrations: 16（repository期待値16と一致）
- runtimeとmigrationの接続先: 同一DB
- Storage bucket: private
- Storage objects: 3
- daily backup: 有効
- `readyForBackupRehearsal`: `true`
- issues: なし

## アプリケーション検証

- `pnpm test`: 成功
  - 単体テスト301件
  - 結合テスト37件
- `pnpm build`: 成功
- PR HEADのGitHub Actions:
  - `verify`: 成功
  - `e2e`: 成功

## stagingデプロイ

- Vercel project: `shime-staging`
- deployment ID: `dpl_FgcLfXXWA5wDmzXzDhcseyCDnqLJ`
- alias: `https://shime-staging.vercel.app`
- deployment URL:
  `https://shime-staging-2npcb1u2c-stockbusinessjp-gmailcoms-projects.vercel.app`

公開スモーク結果:

- `/api/health`: 200 / `status: ok`
- landing page: 200
- staging警告バナー: 表示
- 「本番データを入力しないでください」: 表示
- `robots.txt`: 全クローラー拒否
- 未認証`/admin`: 307
- 未認証の参加者診断API: 401

## 実施していない操作

- production DBへのmigration適用
- productionデプロイ
- `main`へのpushまたはmerge
- 診断設定の有効化
- 実参加者データの使用
- LINEその他の本番通知

## 次の作業

1. stagingで合成参加者だけを使い、認証済みConcierge診断導線を実機確認する。
2. 診断は確認開始時まで無効のまま維持する。
3. `EVENT_CONFIG_20260808.yaml`の`REQUIRED_INPUT` 15件を主催者が確定する。
4. 全導線リハーサルと復旧訓練の結果を記録する。
5. P0がすべて解消するまでproduction Go判定を出さない。
