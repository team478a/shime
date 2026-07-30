# SHIME production基盤 初期反映記録

- 実施日: 2026-07-30（Asia/Tokyo）
- 対象ブランチ: `release/2026-08-08-readiness`
- 対象コミット: `859da688a1383dd0e1a91471fb7a0c7742ca8f7a`
- 実施者: Codex
- 判定: 基盤反映成功。ただし本番Go判定ではない

## 承認範囲

利用者から、productionバックアップ確認、migration 0015を含むDB初期構築、
release版の本番Vercelデプロイ、隔離UATイベント作成について明示的な承認を得た。

今回完了した範囲は、バックアップ確認、DB初期構築、Storage作成、Vercelデプロイまで。
隔離UATテナント・管理者・イベントは、ローカル秘密値の入力待ちで未作成。

## Supabase

- project ref: `dipcpqmbmumazyuorslv`
- project URL: `https://dipcpqmbmumazyuorslv.supabase.co`
- 事前状態: 新規空DB。`drizzle.__drizzle_migrations`は未作成
- Dashboard上の最新physical backup:
  - UTC: 2026-07-30 08:21:45
  - Asia/Tokyo: 2026-07-30 17:21:45
- backup mode: daily

既存0014 DBへの0015単独適用ではなく、新規空DBへの初期構築としてmigration
0000〜0015の全16件を適用した。

### migration事後検証

- migration head: `1784965553645`（0015）
- applied migrations: 16
- public tables: 65
- runtime connection / migration connection: 同一DB
- scope checks: 11件すべて0
- missing constraints: 0
- missing tables: 0
- postflight safe: true

### Storage

次のbucketをprivateで作成・確認した。

- `shime-private-imports`
- `shime-private-concierge`

DBバックアップにはStorage object本体が含まれない。今回bucketは空であり、
本番データ投入前にStorageを含む復旧手順のリハーサルが引き続き必要。

`pnpm supabase:backup-readiness`はDB、migration、private import bucket、
daily backup modeを確認した。残る指摘はローカルDocker Desktop未起動のみ。
これはmigration適用不具合ではなく、ローカル復旧演習ツールの未準備項目。

## Vercel

- project: `shime-production`
- stable URL: `https://shime-production.vercel.app`
- deployment ID: `dpl_GxYHwLiSf2fW36PrGHHKnbeXmzUX`
- deployment state: READY
- target: production

本番専用として次を設定した。

- 本番Supabase runtime接続
- private Storage bucket名
- `APP_ENV=production`
- `APP_URL=https://shime-production.vercel.app`
- 本番専用session/password/link/QR pepper
- internal job / cron secret
- settings encryption key

秘密値は文書、Git、コマンド出力へ記録していない。
`DATABASE_MIGRATION_URL`およびbootstrap用秘密値はVercel runtimeへ登録していない。

LINE/LIFF、OpenAIは未確定のため本番Vercelへ登録していない。
本番LINE導線のUATはこれらの設定後に行う。

### 公開スモーク

- `/` → `/admin`へ307
- `/admin` → `/admin/login`へ307
- `/admin/login` → 200
- `/api/health` → 200
- production画面にstaging警告なし
- `/robots.txt` → publicを許可し、`/admin/`と`/api/`を拒否

## 検証結果

```text
pnpm architecture:check  → 成功
pnpm lint                → 成功（0 errors、既存warningsのみ）
pnpm typecheck           → 成功
pnpm test                → 成功（単体304件、結合37件）
pnpm build               → 成功
pnpm test:e2e            → 成功（29件、意図的skip 3件）
pnpm audit:dependencies  → 成功（既知脆弱性なし）
pnpm readiness           → 完走（productionReady: false、REQUIRED_INPUT 15件）
pnpm readiness:strict    → 失敗（REQUIRED_INPUT 15件。コード不具合ではない）
pnpm format:check        → Windows CRLF差により49ファイルを検出
```

format検出対象は既知のWindows作業ツリー改行差で、Git indexはLF。
今回のreleaseコードに新しいformat差分は追加していない。

## 未完了・停止条件

1. `EVENT_CONFIG_20260808.yaml`のREQUIRED_INPUT 15件を正式決定する。
2. 隔離UATテナント、UAT管理者、合成イベントを作成する。
3. 本番LINE/LIFFを設定し、開発中チャネル制限を解除して端末UATを行う。
4. 独自ドメイン、監視、定期ジョブの本番設定を確認する。
5. DBとStorageを含む復旧リハーサルを非本番復元先で行う。
6. 全導線リハーサルとGo／No-Go記録を完了する。

P0が残るため、現時点で本番イベント利用可能とは判定しない。
