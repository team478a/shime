# SHIME AI引継ぎ記録

最終更新: 2026-07-25（Asia/Tokyo）  
作業ブランチ: `release/2026-08-08-readiness`  
開始時の `main`: `b07d1ce`  
作業状態: **Concierge Phase 1B 実装途中・本番反映不可**

## 中断時の安全状態

- `main` へのマージは行っていない。
- Supabaseへのマイグレーション適用は行っていない。
- Vercelへのデプロイは行っていない。
- SHIME診断を既存イベントでONにする操作は行っていない。
- 外部AI接続、AI生成、AIジョブ、再試行、フォールバック処理は実装していない。
- `.env`、APIキー、LINEトークン、個人情報は変更・コミットしていない。
- 現在のコミットは引継ぎ用のWIPであり、検証完了までは本番へマージしないこと。

## 既存の本番準備ベースライン

このブランチに先行して記録されていた本番準備情報を引き継ぐ。現時点の判定は **Go / No-Go未判定** であり、本番可能とは判定しない。

確認済みの主な内容:

- staging、Supabase migration、private Storage、バックアップ基盤
- 管理者認証、権限、イベント境界、未認証API拒否
- CSV取込後の参加者生成と、イベント単位の決定論的な参加者番号採番
- 合成参加者によるLINE本人連携、Dream、5問、PASS、QR再発行、手動受付、取消、再受付
- 手動受付、本人連携一覧、管理ナビゲーション、席調整画面のスマートフォン改善
- 会場テンプレートの版管理、イベント適用、スナップショット、アーカイブ保持

本番準備として未完了・未判定の主な内容:

- `EVENT_CONFIG_20260808.yaml` の `REQUIRED_INPUT` 解消
- 正式イベント値、正式規約、保存期間の確定
- LINE期限切れ・再利用拒否、QRカメラ受付、Dream非公開・任意スキップ、5問途中保存・辞退の全確認
- 欠席後の席再計算、manager公開、公開前非表示の通し確認
- 希望入力3方式、一方希望非公開、複数成立競合、manager確定
- 結果通知のプレビュー、送信、失敗、再送、二重送信防止
- 通常CSV、責任者限定CSV、紙の受付表・席表による代替運用
- 高頻度ジョブ、監視・通知、production昇格、独自ドメイン
- 匿名化50名・受付端末5台の本番相当リハーサル

既存の本番準備P0順序は次のとおり:

1. 現在状態と本番準備資料の再同期
2. 合成イベントによる非ブロック導線リハーサル
3. ジョブ・監視・復旧確認
4. 正式イベント設定
5. production昇格と最終Go判定

本WIPは上記ベースラインへ追加された未完成機能である。Phase 1Bの検証が終わるまでは、本番準備ブランチをproductionへ昇格しない。

## 実施済み内容

### 1. Concierge Phase 1Bのドメイン基盤

- `packages/concierge` を新設した。
- Phase 1Aで保存したイベント専用スナップショットをZodで検証する処理を追加した。
- 公開可能条件として、4分析軸・8感情・8枚の重複しないカード対応を検証する。
- 診断の開始、途中保存、提出、再回答、結果閲覧、管理設定更新、進捗集計のUseCaseを追加した。
- 判定は `concierge-rule-v1` の決定論的ルールベースとし、生成AIを使用しない。
- 結果は選択カード、固定感情コード、4問の選択内容から構成し、性格・相性・医学的状態を断定しない。
- DBアクセスをRepository実装に限定し、UseCaseからDrizzleを直接参照しない構造にした。
- 保存済み結果の読み出し境界にZodスキーマを追加した。

### 2. DBスキーマ案

`packages/db/src/schema.ts` に次を追加した。

- イベント診断設定:
  - 利用開始日時
  - 利用終了日時
  - 再回答許可
- `concierge_sessions`
- `concierge_answers`
- `concierge_answer_revisions`
- `concierge_rule_results`
- `concierge_access_logs`
- `concierge_session_status` enum

全テーブルでテナント・イベント・参加者のスコープを保持する。回答の改訂履歴とアクセス履歴を残す設計である。

### 3. 参加者向け画面・API

- `/liff/diagnosis` の参加者画面を追加した。
- 8枚を参加者セッション単位で決定論的にシャッフルし、裏面から1枚を選ぶ操作を追加した。
- 4問回答、途中保存、確認、提出、固定ルール結果表示、許可時の回答見直しを追加した。
- スマートフォン向け2列カード表示と大きい操作領域のCSSを追加した。
- 参加者APIを追加した。
  - 診断状態取得
  - 診断開始
  - 途中保存
  - 提出
  - 認証済みカード画像取得
- カード画像のStorage object keyをブラウザへ返さず、認証後の署名URLリダイレクトで配信する形にした。

### 4. 管理画面・参加者導線

- イベント別診断管理画面に次の入力案を追加した。
  - SHIME診断ON/OFF
  - 利用開始・終了日時
  - 提出後の回答見直し許可
  - 対象者、未開始、途中保存、提出済み人数
- 管理APIに診断設定GET/PATCHを追加した。
- 参加者導線設定でSHIME診断をON/OFFできるようにした。
- 診断設定が有効でないイベントでは、SHIME診断を含む導線を公開できないガードを追加した。
- PASS必須、Dream・席案内5問をPASSより前に置く既存制約は維持した。

## 主な変更ファイル

- `packages/concierge/**`
- `packages/db/src/schema.ts`
- `packages/event-core/src/participant-journey-types.ts`
- `packages/event-core/src/participant-journey-repository.ts`
- `packages/event-core/src/manage-participant-journey.ts`
- `packages/event-core/src/drizzle-participant-journey-repository.ts`
- `apps/web/src/server/concierge-diagnosis-use-cases.ts`
- `apps/web/src/hooks/use-diagnosis.ts`
- `apps/web/src/hooks/use-concierge-event-settings.ts`
- `apps/web/src/app/liff/diagnosis/page.tsx`
- `apps/web/src/app/api/liff/events/[eventId]/diagnosis/**`
- `apps/web/src/app/api/admin/events/[eventId]/concierge-status/route.ts`
- `apps/web/src/app/admin/events/[eventId]/concierge/**`
- `apps/web/src/app/admin/events/[eventId]/journey/**`
- `apps/web/src/app/styles.css`

## 未完了内容

### P0: このコミットを本番へ入れる前に必須

1. `pnpm db:generate` を実行し、追加スキーマのDrizzle migrationを生成・レビューする。
2. RepositoryとUseCaseの型エラーを解消し、`pnpm typecheck` を通す。
3. Prettierを適用し、lint・architecture baselineを通す。
4. 単体テストを追加する。
   - 無効・期間外・不正スナップショット
   - 4分析軸・8感情・8カード公開条件
   - 不正回答・重複回答
   - 途中保存・revision conflict
   - 4問未完了時の提出拒否
   - 決定論的な結果
   - 再回答許可/拒否
5. integration testを追加する。
   - 新規migrationの適用
   - テナント・イベント・参加者間のデータ分離
   - 回答履歴・結果・アクセスログ
6. participant API、staff API、カード画像認可の契約テストを追加する。
7. スマートフォン320px相当を含むE2Eを追加する。
8. 下記の全必須チェックを成功させる。
9. staging Supabaseにmigrationを適用し、Phase 1Aの有効なスナップショットを使って端末確認する。
10. 確認完了までは診断設定をOFFのまま維持する。

### P1: Phase 1B完成度向上

- 途中保存時の復帰位置とメッセージを端末で確認する。
- セッション再開時の回答同期と、複数タブ更新競合のUXを確認する。
- カード画像の読み込み失敗表示を追加する。
- 管理画面の設定保存前に確認ダイアログを追加する。
- 診断ONのまま新しいテンプレートスナップショットを適用する場合の安全な挙動を決める。
- 診断回答・結果の保存期間、削除・匿名化運用を正式決定する。
- アクセスログ件数増加への運用監視を決める。

### P2: 今回の範囲外

- Concierge Phase 2の外部AI接続
- AI生成レポート、AIジョブ、再試行、フォールバック処理
- Love Passport公開プロフィールとの連携
- 他サービス版への診断テンプレート横展開

## テスト結果

この中断時点で、完了したテストはない。

実行を試みたコマンド:

```text
pnpm install --lockfile-only
pnpm db:generate
pnpm typecheck
```

結果:

- コマンド実行全体がツールの短いタイムアウトで終了した。
- `pnpm-lock.yaml` の変更は確認されていない。
- 新しいmigrationファイルは生成されていない（最新は既存の `0014_thankful_the_executioner.sql`）。
- `pnpm db:generate` と `pnpm typecheck` が実際に開始・完了したとはみなせない。
- lint、format check、architecture check、unit、integration、build、E2Eは未実行。

## 次に行う作業

1. このブランチを取得し、作業ツリーが本コミットだけであることを確認する。
2. `pnpm install --lockfile-only` を単独実行する。
3. `pnpm typecheck` を先に実行し、型エラーを小さい単位で修正する。
4. `pnpm db:generate` を実行してmigrationを生成し、tenant/event制約、外部キー、unique indexをレビューする。
5. Conciergeの単体・統合・API契約・E2Eテストを追加する。
6. 次の順番で必須チェックを実行する。

```text
pnpm format
pnpm format:check
pnpm architecture:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm build
pnpm test:e2e
pnpm audit:dependencies
```

7. 全チェック成功後にのみstaging Supabaseへmigrationを適用する。
8. stagingで管理設定OFFのままスナップショット検証を行い、その後に短い利用期間を設定して端末試験する。
9. 端末試験と権限・監査確認が成功した後、Phase 1B完成コミットを作る。
10. 本番反映は別途レビューと明示承認を受けて行う。

## 既知の注意点

- 今回追加したコードは未フォーマット・未型検証である。
- migrationが存在しないため、現状のアプリコードをデプロイするとDB列・テーブル不足で失敗する。
- イベント診断をONにする管理操作は、有効なPhase 1Aスナップショットが存在する場合だけ成功する設計だが、テスト未完了である。
- 参加者導線に診断を含める公開ガードは追加済みだが、Repository fakeを含む既存テストへの追従が必要な可能性がある。
- 管理画面の既存ページには以前から直接DB参照が残る。今回追加した更新処理はUseCase経由だが、今後のリファクタリングで読み取りもRepository経由へ移す余地がある。
