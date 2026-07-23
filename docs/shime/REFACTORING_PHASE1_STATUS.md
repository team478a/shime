# SHIME リファクタリング Phase 1 進捗記録

更新日: 2026-07-24

## 今回の対象

共通API Handlerをスタッフアカウント管理、当日受付、参加者向けAPIへ段階的に適用した。

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
- `POST /api/liff/events/:eventId/passport`
- `POST /api/liff/events/:eventId/passport/qr`
- `PUT /api/liff/me/dream`
- `POST /api/liff/me/dream/skip`
- `POST /api/liff/events/:eventId/dream/suggestions`
- `GET /api/liff/events/:eventId/emotion-cards`
- `POST /api/liff/events/:eventId/emotion-selection`

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
- SHIME PASS発行とQR再発行APIを移行し、更新系でもrequestとRoute引数が維持される契約テストを追加
- Dream保存、任意スキップ、候補生成APIを移行
- body内event IDを使うDream APIは、既存どおり入力検証後に認証を行う順序を維持
- Dream保存時の参加者更新と感情カード参照にtenant・event境界を明示
- 感情カード取得と感情選択保存APIを移行
- 感情選択時のカードIDをイベントに設定されたカードセットへ限定
- 感情選択と参加者状態の更新条件にtenant・event・participant境界を明示
- 未ログインとイベント未紐づけを既存どおり401として扱う契約を維持

## 互換性

- UI変更なし
- endpointとHTTP methodの変更なし
- 正常・異常responseのfieldとstatus codeの変更なし
- DB Schema、Migration、保存処理の変更なし
- tenant境界と監査ログを維持

スタッフ一覧GETの認証・権限エラーには既存どおり`request_id`を含めない。作成・更新APIには既存どおり含める。全APIのresponse統一は、互換方針を別途決めずに一括実施しない。

## Phase 1の残作業

1. participantHandlerの設問・希望入力APIへの段階適用
2. publicHandler
3. jobHandler
4. webhookHandler
5. 対象Routeの契約テストを追加しながら1モジュールずつ移行
6. 共通AuditとValidationの適用範囲拡大

## 検証結果

- format-check、architecture-check、typecheck、production build成功
- lint成功（新規警告なし）
- Unit: 51ファイル、185テスト成功
- Integration: 1ファイル、2テスト成功
- E2E: 25テスト成功、対象外1テスト

## 次の推奨対象

参加者向け設問・回答APIの認証共通化を候補とする。ただし、設問管理等の業務UseCase・Repository分離と混在させず、Phase 1ではHandler適用と契約テストだけに限定する。
