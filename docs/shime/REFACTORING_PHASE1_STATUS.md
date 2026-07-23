# SHIME リファクタリング Phase 1 進捗記録

更新日: 2026-07-24

## 今回の対象

共通API Handlerの最初の適用として、スタッフアカウント管理APIだけを移行した。

- `GET /api/admin/staff`
- `POST /api/admin/staff`
- `PATCH /api/admin/staff/:userId`

## 実施内容

- `staffHandler`を追加
- 認証、権限、Request ID、既知エラーのHTTP変換を共通化
- JSON入力のZod検証を共通化
- `AppError`、`ValidationError`、`PermissionError`、`BusinessRuleError`、`InfrastructureError`を追加
- スタッフ管理専用権限`staff:manage`を追加し、`system_admin`だけへ付与
- 既存staff APIのstatus codeとresponse bodyを契約テストで固定

## 互換性

- UI変更なし
- endpointとHTTP methodの変更なし
- 正常・異常responseのfieldとstatus codeの変更なし
- DB Schema、Migration、保存処理の変更なし
- tenant境界と監査ログを維持

スタッフ一覧GETの認証・権限エラーには既存どおり`request_id`を含めない。作成・更新APIには既存どおり含める。全APIのresponse統一は、互換方針を別途決めずに一括実施しない。

## Phase 1の残作業

1. event scopeを扱うstaffHandler拡張
2. participantHandler
3. publicHandler
4. jobHandler
5. webhookHandler
6. 対象Routeの契約テストを追加しながら1モジュールずつ移行
7. 共通AuditとValidationの適用範囲拡大

## 検証結果

- format-check、architecture-check、typecheck、production build成功
- lint成功（新規警告なし）
- Unit: 50ファイル、178テスト成功
- Integration: 1ファイル、2テスト成功
- E2E: 25テスト成功、対象外1テスト

## 次の推奨対象

スタッフ認証済みかつevent scopeを必要とする当日受付APIを候補とする。ただし、受付UseCase・Repository分離と混在させず、Phase 1ではHandler適用と契約テストだけに限定する。
