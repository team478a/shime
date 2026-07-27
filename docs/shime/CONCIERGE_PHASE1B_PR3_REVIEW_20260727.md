# SHIME Concierge Phase 1B PR #3 レビュー記録

- レビュー日: 2026-07-27
- 対象リポジトリ: `team478a/shime`
- 対象PR: [PR #3](https://github.com/team478a/shime/pull/3)
- 対象ブランチ: `claude/shime-codex-handoff-k76e1n`
- ベースブランチ: `release/2026-08-08-readiness`
- レビュー対象HEAD: `66a6cf719dbbf5040127011fab96094d9a2d9cb9`
- 判定: **現時点ではマージ保留**

## 修正追跡

- 2026-07-27: P0/P1の修正を実装コミット`f04d045fcae7bd59a2365f7404d5b1068ffd1a23`へ記録。
- P0: `events`を基点とするsnapshot・participantのtenant/event複合外部キーと正常・不整合INSERTテストを追加。
- P1: 選択前カード表面の非公開化、選択時即時保存、選択済みカード限定の表面・画像認可を追加。
- ローカル必須検証は、Windows CRLFによる`format:check`と運営入力15件による`readiness:strict`を除いて成功。
- **独立した再レビューが完了するまで、PR #3のマージ保留判定は維持する。**

## 1. 結論

PR #3は、テスト追加、診断セッションのモバイル状態同期修正、revision conflict、二重提出防止、複合外部キーの追加など、Concierge Phase 1Bの品質を大きく改善している。

一方、次の2件はマージ前に修正が必要である。

1. `event_concierge_snapshots`の`tenant_id`と`event_id`の組み合わせが、DBレベルで対象イベントのテナントに結び付いていない。
2. 参加者がカードを選ぶ前に、全カードの表面情報と画像へアクセスできる。

また、`AI_HANDOFF.md`の最新コミット記載が実際のPR HEADと一致していない。

GitHub上ではPRは競合なくマージ可能な状態であり、CIの`verify`と`e2e`も成功している。しかし、上記のデータ境界・非公開情報に関する問題が残るため、運用上のマージ可否は**保留・修正必要**と判定する。

## 2. マージ前の必須修正

### P0: Conciergeスナップショットのtenant/event整合性がDBで保証されていない

対象:

- `packages/db/src/schema.ts`
- `packages/db/migrations/0015_strange_mandroid.sql`
- Concierge DB結合テスト

現状の`event_concierge_snapshots`は、次の外部キーを個別に持っている。

- `tenant_id -> tenants.id`
- `event_id -> events.id`

しかし、`(tenant_id, event_id) -> events(tenant_id, id)`の複合外部キーがない。このため、テナントAのスナップショットに、テナントBのイベントIDを組み合わせた不整合レコードを登録できる。

レビュー時に全migrationを適用したPGliteで確認した結果:

```json
{
  "crossTenantSnapshotInsertAccepted": true
}
```

下流テーブルに追加された複合外部キーはスナップショットを基準にしているため、基点となるスナップショット自体が不整合だと、tenant/event境界を完全には保証できない。

必要な対応:

1. `events(tenant_id, id)`に、複合外部キーの参照先として使用できる実体のあるUNIQUE制約を追加する。
2. `event_concierge_snapshots(tenant_id, event_id)`から`events(tenant_id, id)`への複合外部キーを追加する。
3. Drizzle schemaとmigration SQLの両方を一致させる。
4. 異なるtenantのeventを使ったスナップショットINSERTが失敗する結合テストを追加する。
5. 必要に応じて、参加者・診断セッション側でもeventスコープの基点が同様に保護されているか再確認する。

完了条件:

- 正常な同一tenant/eventのINSERTは成功する。
- cross-tenantのtenant/event組み合わせはDBが拒否する。
- migrationを新規DBへ適用できる。
- Drizzle schemaとmigration SQLが一致する。

### P1: カード選択前に全カードの表面情報が公開される

対象:

- `apps/web/src/app/api/liff/events/[eventId]/diagnosis/route.ts`
- `packages/concierge/src/drizzle-repository.ts`
- 参加者API契約テスト

診断開始時の参加者APIは、カード選択前にも全カードについて次の情報を返している。

- タイトル
- メッセージ
- 感情コード
- 画像URL
- その他カード表面のデータ

また、カード画像取得処理は、対象イベントの有効なスナップショットに含まれるカードであれば、現在の参加者が選択したカードかどうかを確認せず取得できる。アクセス可能期間の検証も不足している。

これは「裏面から1枚を選び、選択後に表面を表示する」という診断導線と、回答・診断情報の非公開方針に反する。

必要な対応:

1. 選択前のAPIレスポンスは、カード表面を推測できない情報だけに限定する。
   - opaqueなカードID
   - 表示順
   - 共通の裏面表示に必要な情報
2. カード選択をサーバーへ直ちに保存する。
   - 空回答を許可した既存保存処理、または専用の選択UseCaseを使用する。
3. 表面情報と画像は、現在の参加者セッションで選択済みのカードだけ取得可能にする。
4. イベントおよび診断のアクセス可能期間を画像取得時にも検証する。
5. 未選択カードの表面情報・画像が取得できない契約テストを追加する。
6. 他参加者の選択カード・回答・診断結果へアクセスできないことも併せて確認する。

完了条件:

- 選択前のレスポンスにカード表面情報が含まれない。
- 選択していないカードの画像取得は拒否される。
- 選択済みカードだけ、同一参加者セッションから取得できる。
- cross-tenant、cross-event、cross-participantの取得が拒否される。

## 3. 文書修正

### P2: `AI_HANDOFF.md`の最新コミットがPR HEADと不一致

対象:

- `docs/shime/AI_HANDOFF.md`

文書には最新コミットとして`db72ca8`が記録され、「PR HEADと一致」と説明されているが、実際のPR HEADは次である。

```text
66a6cf719dbbf5040127011fab96094d9a2d9cb9
```

必要な対応:

- 最新コミットとPR HEADの記載を`66a6cf7`へ更新する。
- 今回のレビュー判定と未解決のP0/P1を追記する。
- migration未適用、未デプロイ、未マージである現在状態は維持して記録する。

## 4. 確認できた良好な点

### DB・migration

- `0015_giant_rick_jones.sql`は途中コミットで生成された旧migrationであり、最新ブランチには存在しない。
- 最新migrationは`packages/db/migrations/0015_strange_mandroid.sql`。
- 旧migrationは未適用だったため、複合外部キー対応版へ置き換えられている。
- 最新migrationはPGlite結合テストで新規DBへ正常に適用できる。
- 実装済みの制約については、migration SQLとDrizzle schemaの対応を確認した。

### 認証・認可・非公開情報

- 参加者APIはイベントを解決した上で、tenant/event/userに紐づくLINE連携済み参加者を要求している。
- スタッフ状態確認APIのGETは`concierge:manage`権限を要求する。
- スタッフ更新APIのPATCHは`concierge:publish`権限を要求する。
- 新規スタッフAPIから診断回答値を取得する経路は確認されなかった。
- 参加者の回答・結果は本人の参加者セッションにスコープされている。
- APIレスポンスからストレージの内部object keyを直接公開していない。

### revision conflict・二重提出防止

- セッション更新時に期待revisionを使用している。
- 更新対象を`in_progress`状態に限定している。
- セッション更新と結果保存はトランザクション内で処理される。
- 競合または二重送信では更新失敗・conflictとなる。
- 診断結果のrevisionに対する一意制約が追加防御として機能する。

### モバイル状態同期

- 保存後に`selectedCardAssetVersionId`をクライアント状態へ反映する修正を確認した。
- 画面の再同期条件がrevision依存から`${session.id}:${submittedAt}`へ変更されている。
- 対応するE2Eテストは成功した。

### 既存機能への影響

- lint、typecheck、単体テスト、結合テスト、build、E2Eは成功した。
- architecture debt baselineは増加していない。
- dependency auditで既知の脆弱性は検出されなかった。

## 5. 実行した検証

| コマンド | 結果 | 補足 |
|---|---:|---|
| `pnpm format:check` | ローカル失敗 | Windows作業ツリーのCRLFが原因。Git indexはLFで、同一HEADのGitHub Actionsでは成功 |
| `pnpm architecture:check` | 成功 | Route DB import 62/62、Client direct fetch 24/24、300行超 9/9でbaseline内 |
| `pnpm lint` | 成功 | エラー0。既存を含む警告あり |
| `pnpm typecheck` | 成功 | 型エラーなし |
| `pnpm test` | 成功 | unit: 65 files / 287 tests、integration: 2 files / 22 tests |
| `pnpm build` | 成功 | Next.js production build成功 |
| `pnpm test:e2e` | 成功 | 29件成功、3件は意図されたskip |
| `pnpm audit:dependencies` | 成功 | 既知の脆弱性なし |
| `pnpm readiness` | コマンド成功 | `productionReady: false`、必須入力15件が未確定 |
| `pnpm readiness:strict` | 想定どおり失敗 | コード不具合ではなく、`EVENT_CONFIG_20260808.yaml`の`REQUIRED_INPUT` 15件が原因 |

GitHub Actions:

- `verify`: 成功
- `e2e`: 成功

### format checkの扱い

ローカルリポジトリは`core.autocrlf=true`で、Git index上はLF、Windows作業ツリー上はCRLFとなっていた。Prettierはこの作業ツリー上の改行差を検出した。

同じコミットに対するUbuntuのGitHub Actionsでは`format:check`が成功しているため、PRソースのフォーマット不良とは判定しない。ただし、Windows開発環境での再発を避けるため、`.gitattributes`または開発手順で改行ルールを明確化することを推奨する。

## 6. readiness:strictの未確定15項目

次の未確定項目はコード不具合とは分けて管理する。

1. `event.name`
2. `event.ends_at`
3. `event.venue_name`
4. `event.venue_address`
5. `application.opens_at`
6. `application.closes_at`
7. `preference.opens_at`
8. `preference.closes_at`
9. `participants.categories[0].label`
10. `participants.categories[1].label`
11. `seating.conversation_rounds`
12. `emotion_cards.card_set_code`
13. `privacy.retention_days`
14. `privacy.event_terms_version`
15. `privacy.privacy_version`

これらが確定し、設定ファイルへ反映されるまで、本番準備完了とは判定できない。

## 7. 推奨する修正順

1. P0のスナップショットtenant/event複合外部キーを追加する。
2. cross-tenantスナップショットINSERT拒否テストを追加する。
3. P1のカード選択前レスポンスを非公開化する。
4. カード選択の即時保存と、選択済みカード限定の画像認可を実装する。
5. API契約テスト、結合テスト、E2Eを追加する。
6. `AI_HANDOFF.md`をPR HEADとレビュー結果に合わせて更新する。
7. 必須チェック一式を再実行する。
8. 指摘解消後に、`release/2026-08-08-readiness`へのマージ可否を再判定する。

## 8. 今回実施していない操作

- PR #3のマージ
- DB migrationの適用
- stagingまたはproductionへのデプロイ
- `main`へのpush
- 本番データの使用
- 本番通知
- レビュー結果のコミットまたはpush
