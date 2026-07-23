# SHIME リファクタリング Phase 0 実施記録

更新日: 2026-07-24
対象: `team478a/shime` / `main`

## Phase 0の目的

UI、API、DB、既存業務動作を変更せず、以後の段階的リファクタリングを安全に進めるための品質基盤と開発ルールを整える。

## 実施内容

- Prettierを導入し、`format`と`format:check`を追加
- 改行、引用符、行長等の共通フォーマットを設定
- ESLintに`max-lines`、`complexity`、`max-depth`、`max-len`、import並び順のルールを追加
- CIにformat-checkとarchitecture-checkを追加
- Routeからの直接DB参照、Client Componentからの直接fetch、巨大ファイル数を計測するアーキテクチャ基準を追加
- Route、UseCase、Repository、Component、Hookの依存ルールを文書化
- リファクタリングマスタープランをリポジトリ内の参照文書として追加

## 現在の基準値

既存コードを即座に全面修正しないため、Phase 0では以下を増加禁止の基準値とする。

| 指標 | 基準値 |
| --- | ---: |
| API RouteからのDB直接import | 69 |
| Client Component内の直接fetchを含むファイル | 25 |
| 300行を超えるソースファイル | 11 |

各モジュールを移行するPRでは、対象指標を維持するだけでなく減少させる。新規違反はCIで失敗する。

## 段階導入にした事項

- 既存違反が多いため、複雑度、深さ、行数、import順序はPhase 0では警告とした。
- 「RouteからDBアクセス禁止」と「ComponentからAPI直接呼び出し禁止」は、新規増加をCIで禁止するラチェット方式とした。
- APIレスポンス統一は既存API仕様を変えない条件と衝突するため、新規APIと契約テストを伴う移行対象から適用する。
- Phase 0はリポジトリ全体の開発基盤を扱うため、「1PR=1Module」の例外とする。Phase 1以降は1フェーズ・1モジュール単位で進める。

## Phase 0で変更しないもの

- 画面デザインと画面遷移
- 公開APIのリクエスト・レスポンス
- DB Schema、Migration、保存データ
- 認証、権限、業務ルール
- 本番・stagingの環境変数

## Phase 1開始条件

- format、architecture、lint、typecheck、unit、integration、build、e2eが成功している
- GitHub Actionsが成功している
- Phase 0変更が`main`へ反映されている

## ローカル検証結果

2026-07-24に以下を実行した。

| 検証 | 結果 |
| --- | --- |
| `pnpm format:check` | 成功 |
| `pnpm architecture:check` | 成功 |
| `pnpm lint` | 成功（エラー0、既存負債の警告77件） |
| `pnpm typecheck` | 成功 |
| `pnpm test:unit` | 49ファイル、173テスト成功 |
| `pnpm test:integration` | 1ファイル、2テスト成功 |
| `pnpm build` | production build成功 |
| `pnpm test:e2e` | 25テスト成功、対象外1テスト |

GitHub Actions `ci`（run `30023946769`）でもverifyとe2eの全Jobが成功した。既存コード品質警告に加え、GitHub Actions v4系のNode.js 20互換実行に関する廃止予定警告があるため、後続の保守タスクでActionsの対応版を確認する。

## Phase 1変更予定

共通Handlerの設計と導入を、既存API契約を維持したまま1種類ずつ行う。最初の候補はstaff向けAPIであり、認証、権限、Request ID、Tenant/Event境界、Validation、Audit、Error Responseを共通化する。対象Routeには契約テストを先に追加する。
