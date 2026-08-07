# Migration 0016-0021 staging適用記録

実施日時: 2026-08-07（Asia/Tokyo）  
対象: Supabase staging / project ref `dnjurujktndyyevxfweb`  
対象外: production

## 承認と適用範囲

利用者の明示承認に基づき、stagingで未適用だったmigration 0016から0021を順番に適用した。stagingは適用前に0015までの16件、リポジトリは0021までの22件だったため、Drizzleの通常手順では0021だけを飛び越えて適用できないことを事前に報告した。

## 適用前確認

- `APP_ENV=staging`
- migration接続: direct PostgreSQL 5432
- runtime接続とmigration接続: 同一DB
- 適用済みmigration: 16件
- public table: 65件
- Supabase backup mode: daily
- import Storage bucket: 存在、private
- Docker / backup tool: 利用可能

### 論理バックアップ

リポジトリ外の`C:\Users\Owner\Documents\ShimeBackups\staging-pre-0016-0021-20260807-012154`へ取得した。

| ファイル | サイズ | SHA-256 |
| --- | ---: | --- |
| `roles.sql` | 5,370 bytes | `ace93cf8d650a8fd964896f19efaf998b168b56c0c3a6184ae6f386e2a23b9c3` |
| `schema.sql` | 289,561 bytes | `4b8a5e5f7b2875eaf0de37cefc8a2f19039dade8dd1b751d6a17c0dd0ef0c3f5` |
| `data.sql` | 206,615 bytes | `f366bcdf17b9229201e40149e24451804e53dea9bbdd367e41abc2783394aa9b` |

## 適用

stagingの`DATABASE_MIGRATION_URL`を明示したプロセスで`pnpm db:migrate`を実行し、0016、0017、0018、0019、0020、0021を適用した。

出力されたNOTICEは、既存`drizzle` schema / migration tableのスキップと、PostgreSQLの63文字制限による長い制約名の短縮だけで、migrationエラーはなかった。

## 適用後確認

- migration接続: 正常
- runtime接続: 正常
- runtime接続とmigration接続: 同一DB
- 適用済みmigration: 22 / 22件
- public table: 70件
- backup readiness: 合格、issue 0件
- `event_interaction_note_snapshots`の`public_profile_field_keys_json`、`status`、`published_at`、`stopped_at`: 存在
- status CHECK / lifecycle CHECK: 存在
- tenant/event複合scope制約: 存在
- 同一tenant/event/serviceの公開版を1件に限定する部分UNIQUE index: 存在
- `staff_roles.permissions_json`: 存在
- lifecycle不整合行: 0件
- 複数公開scope: 0件
- 既存会話メモsnapshot: 0件（backfill対象なし）

## 適用直後の安全状態

- production migrationは実施していない。
- このmigration記録作成時点ではstaging / productionへのアプリケーションデプロイを実施していなかった。その後、利用者の別承認によりstagingだけへ配備した。
- このmigration記録作成時点では会話メモ設定の作成・公開・停止を実施していなかった。その後、合成イベントでUATを行い、終了時に公開版0件へ戻した。
- 実参加者データ、LINE通知、本番設定は使用・変更していない。
- 後続の配備・UAT結果は`INTERACTION_MEMO_STAGING_UAT_20260807.md`を参照する。
