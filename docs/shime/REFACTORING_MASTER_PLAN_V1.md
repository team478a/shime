# SHIME リファクタリングマスタープラン

Version: 1.0
Target Repository: `team478a/shime`
Target Branch: `main`

## 目的

現在の機能と外部仕様を維持しながら、SHIMEを段階的にモジュラーモノリスへ移行し、保守性、拡張性、開発速度を改善する。全面リライトは行わない。

## 絶対条件

- UIを変えない
- API仕様を変えない
- DBを壊さない
- 既存テストを通す
- 本番イベントに影響させない
- 段階的にリファクタリングする

## 目標構成

```text
apps/
  web/

packages/
  shared/
  identity/
  event-core/
  applications/
  checkin/
  dream/
  questionnaire/
  passport/
  seating/
  matching/
  notifications/
  integrations/
  db/
```

## 依存方向

```text
Route -> UseCase -> Repository -> DB
UI -> Hook -> API
```

- RouteはHTTP処理とUseCase呼び出しだけを担当する。
- UseCaseはHTTP、UI、DBへ直接依存せず、Repositoryインターフェースを利用する。
- DrizzleはRepository実装だけが利用する。
- Client ComponentはAPIを直接呼び出さず、機能別Hookを利用する。

## 実施フェーズ

### Phase 0: 開発ルール整備

Prettier、format、format-check、ESLint品質ルール、CI、アーキテクチャ境界、開発ルールを整備する。

### Phase 1: 共通API Handler

`staffHandler`、`participantHandler`、`publicHandler`、`jobHandler`、`webhookHandler`を導入し、認証、権限、Request ID、Tenant、Event、Audit、Validation、Error、Responseの共通処理を分離する。

### Phase 2: Seating Module

席配置の取得、作成、保存、公開、Conversation生成をRepository、UseCase、Serviceへ分離する。

### Phase 3: Matching Module

Preference、Candidate、Approve、Reject、Confirm、Notificationを分離する。

### Phase 4: Application Module

申込、CSV、重複判定、Participant、LINE Linkを分離する。

### Phase 5: Event Configuration

Event、Table、Questionnaire、Dream、Notification、Template、Snapshotを分離する。

### Phase 6: Schema分割

単一の`schema.ts`をidentity、event、application、dream、passport、matching、notificationへ分割する。

## 横断要件

- `settings_json`等の設定値はZod Schemaで検証する。
- APIの新規・移行対象は成功時`{ data }`、失敗時`{ code, message, request_id }`を標準とする。
- 既存APIの外部契約は一括変更せず、契約テストを伴う段階移行とする。
- `AppError`、`ValidationError`、`PermissionError`、`BusinessRuleError`、`InfrastructureError`を導入する。
- Domain EventとOutboxを段階導入する。
- Application、Repository、Contract、UseCaseのテストを追加する。
- 巨大Componentを責務単位に分割する。

## 完了条件

- API RouteがHTTP処理に限定され、概ね20〜50行になる
- UseCaseとRepositoryが存在する
- RouteがDBへ直接アクセスしない
- 画面から業務ロジックが除かれる
- 巨大Componentが解消される
- 設定JSONが型付け・検証される
- モジュール依存が明確になる
- 既存機能、UI、API、DB互換性を維持する
- 全テストが成功する

## 優先順位

1. Phase 0、Phase 1、Phase 2
2. Phase 3、Phase 4
3. Phase 5、Phase 6

## 禁止事項

- 全面リライト
- マイクロサービス化
- API、DB、UI、既存仕様の無断変更
- 根拠のない最適化

## 最終目標

1機能を1モジュールとして修正範囲を限定し、SHIME OS共通基盤上で婚活、ビジネス、ライフ、企業版、教育版へ横展開できる構造を実現する。
