# SHIME リファクタリング Phase 1 進捗記録

更新日: 2026-07-24

## 今回の対象

共通API Handlerをスタッフアカウント管理APIと当日受付APIへ段階的に適用した。

- `GET /api/admin/staff`
- `POST /api/admin/staff`
- `PATCH /api/admin/staff/:userId`
- `POST /api/admin/events/:eventId/checkins/manual`
- `POST /api/admin/events/:eventId/checkins/scan`
- `POST /api/admin/events/:eventId/checkins/confirm`
- `POST /api/admin/events/:eventId/checkins/:participantId/cancel`
- `GET /api/liff/events/:eventId`
- `GET /api/liff/events/:eventId/seat`
- `GET /api/liff/me/passport/:eventId`

## 実施内容

- `staffHandler`を追加
- 認証、権限、Request ID、既知エラーのHTTP変換を共通化
- JSON入力のZod検証を共通化
- `AppError`、`ValidationError`、`PermissionError`、`BusinessRuleError`、`InfrastructureError`を追加
- スタッフ管理専用権限`staff:manage`を追加し、`system_admin`だけへ付与
- 既存staff APIのstatus codeとresponse bodyを契約テストで固定
- event scope付き`staffEventHandler`を追加
- イベント限定スタッフは割り当てられたイベントだけ操作可能とし、全体権限スタッフは従来どおり各イベントを操作可能
- 受付APIの既存エラーコード、status code、response bodyを維持
- `participantHandler`を追加し、参加者セッション、tenant、event、participant文脈を共通化
- 読み取り専用の参加者API 3件を移行
- 未ログインとイベント未紐づけを既存どおり401として扱う契約を維持

## 互換性

- UI変更なし
- endpointとHTTP methodの変更なし
- 正常・異常responseのfieldとstatus codeの変更なし
- DB Schema、Migration、保存処理の変更なし
- tenant境界と監査ログを維持

スタッフ一覧GETの認証・権限エラーには既存どおり`request_id`を含めない。作成・更新APIには既存どおり含める。全APIのresponse統一は、互換方針を別途決めずに一括実施しない。

## Phase 1の残作業

1. participantHandlerの更新系APIへの段階適用
2. publicHandler
3. jobHandler
4. webhookHandler
5. 対象Routeの契約テストを追加しながら1モジュールずつ移行
6. 共通AuditとValidationの適用範囲拡大

## 検証結果

- format-check、architecture-check、typecheck、production build成功
- lint成功（新規警告なし）
- Unit: 51ファイル、184テスト成功
- Integration: 1ファイル、2テスト成功
- E2E: 25テスト成功、対象外1テスト

## 次の推奨対象

参加者向け更新APIの認証共通化を候補とする。ただし、回答保存等の業務UseCase・Repository分離と混在させず、Phase 1ではHandler適用と契約テストだけに限定する。
