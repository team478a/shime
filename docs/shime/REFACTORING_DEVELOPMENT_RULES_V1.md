# SHIME リファクタリング開発ルール

Version: 1.0
更新日: 2026-07-24

## 目的

既存のUI、API、DB、業務仕様を変えず、SHIMEを段階的にモジュラーモノリスへ移行する。
全面リライト、マイクロサービス化、動作を伴う独自最適化は禁止する。

## 変更単位

- 原則として1変更・1PRは1モジュールだけを対象にする。
- Phase 0の品質基盤やCIなど、全体へ必要な横断設定だけを例外とする。
- 各Phase開始前に対象API、DB query、画面、テスト、外部連携の境界を記録する。
- 移行前後のAPI contractと業務結果が同一であることをcontract testで確認する。

## 依存方向

```text
Route / UI
    ↓
UseCase / Hook
    ↓
Repository interface
    ↓
Repository implementation
    ↓
Drizzle / external provider
```

### Route

- HTTP requestの取得、handler呼び出し、HTTP responseへの変換だけを担当する。
- 新規または移行済みRouteから`@shime/db`をimportしない。
- 認証、権限、request ID、tenant/event scope、validation、error responseは共通handlerを利用する。

### UseCase

- HTTP、React、Next.js、Drizzleへ依存しない。
- Repository interfaceとdomain serviceだけを利用する。
- tenant IDと、必要な場合はevent IDを必須入力にする。

### Repository

- 移行済みモジュールではRepository implementationだけがDrizzleを利用できる。
- tenant/event条件を全queryへ含める。
- transaction境界はUseCaseの要求を満たすRepositoryまたはUnit of Workで明示する。

### Component / Hook

- 新規または移行済みClient Componentから`fetch`を直接呼ばない。
- module hookへ通信、loading、error、retryを集約する。
- リファクタリングだけで表示、文言、操作順、touch targetを変更しない。

## API contract

- 既存endpoint、method、status code、field名を維持する。
- 新規APIの成功responseは`{ data }`、失敗responseは`{ code, message, request_id }`を標準とする。
- 既存APIのresponse統一は破壊的変更として一括実施せず、互換層とcontract testを用意して個別に移行する。

## Configuration

- 新規または変更するJSON設定にはZod schemaを定義する。
- parse前の値をdomain logicへ渡さない。
- versioned templateからeventへ適用する場合はsnapshotとhashを保存する。

## 品質ゲート

- `pnpm format:check`
- `pnpm architecture:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm build`

Phase 0では既存負債を即座に全エラー化しない。`architecture:check`の基準値を上限として新しい違反を禁止し、
各モジュール移行で基準値を必ず引き下げる。

## 禁止事項

- 全面リライト
- UIまたはAPI contractの無断変更
- migrationなしのschema変更
- 既存データの破壊・再生成
- Routeへの新規DB access追加
- UseCaseからのDrizzle、HTTP、UI参照
- RepositoryからのUI参照
- Client Componentへの新規直接API通信
- PII、token、secret、raw CSV、private回答のlog出力
- 本番イベント設定とリファクタリングの同時変更
