# SHIME リファクタリング Phase 2 進捗記録

更新日: 2026-07-24

## Phase 2の目的

Seating Moduleを段階的に`Route → UseCase → Repository → DB`へ分離する。UI、API仕様、DB semantics、決定論的な席配置ルールは変更しない。

## 今回の対象

- `GET /api/admin/events/:eventId/seating-runs`

## 実施内容

- `@shime/seating`パッケージを追加
- 席配置画面の取得処理を`GetSeatingWorkspace` UseCaseへ分離
- Seating RepositoryインターフェースとDrizzle実装を追加
- 席配置実行履歴、割当、参加者、席の取得条件にtenant・event境界を明示
- 実行履歴に対応する割当だけをRepositoryから取得
- `config_snapshot_json`、`target_snapshot_json`、`score_summary_json`、`explanation_json`をRepository境界でZod検証
- 既存の実行履歴順、割当グループ化、参加者・席レスポンスを維持
- GET Routeを共通`staffEventHandler`へ移行
- 空データと複数実行履歴のグループ化を確認するUseCaseテスト2件を追加

## 互換性

- UI変更なし
- endpointとHTTP methodの変更なし
- 正常・異常responseのfieldとstatus codeの変更なし
- DB Schema、Migration、保存処理の変更なし
- 席配置生成、手動保存、公開処理の変更なし
- tenant境界、event境界、権限を維持

## Phase 2の残作業

1. 席配置生成POSTのUseCase・Repository分離
2. 手動割当保存PATCHのUseCase・Repository分離
3. 席配置公開POSTのUseCase・Repository分離
4. 公開時Conversation生成の分離
5. Seating画面の直接fetchを`useSeating` hookへ移行
6. 対象Routeの契約テストとRepository統合テスト追加

## 検証結果

- format-check、architecture-check、typecheck、production build成功
- lint成功（エラー0件、既存警告のみ）
- Unit: 60ファイル、216テスト成功
- Integration: 1ファイル、2テスト成功
- E2E: 27テスト成功、対象外1テスト
- 300行超のsource file基準値を11件から10件へ削減

## 次の推奨対象

次は`POST /api/admin/events/:eventId/seating-runs`の席配置生成を分離する。決定論的ロジックは変更せず、イベント設定JSONのZod境界、Repositoryのtenant・event境界、トランザクションと監査ログを維持する。
