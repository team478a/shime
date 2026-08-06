# 会話メモ設定 staging UAT記録

実施日時: 2026-08-07（Asia/Tokyo）  
対象: Vercel `shime-staging` / Supabase staging  
対象外: production

## 承認と安全条件

利用者の明示承認に基づき、PR #23のアプリケーションをstagingへ配備し、合成イベントだけで会話メモ設定の版管理UATを実施した。

- 実参加者データは使用していない。
- LINE通知、参加者メモ、マッチ結果は作成していない。
- production、release、mainは変更していない。
- UAT終了時に公開中の会話メモ設定を0件へ戻した。

## デプロイ

- Vercel project: `shime-staging`
- deployment ID: `dpl_54tq57UaTwpBvapZWmRQMjLK4mYL`
- deployment URL: `https://shime-staging-edl2ktskc-stockbusinessjp-gmailcoms-projects.vercel.app`
- alias: `https://shime-staging.vercel.app`
- status: Ready
- `/api/health`: 200
- `/admin/login`: 200
- staging警告と「本番データを入力しない」表示: 確認済み

Vercel projectのProduction環境には必要な19変数が登録されている。CLIのenv pullでは暗号化済み値を取得できなかったため、取得値をローカルビルドへ渡さず、Vercel側の保存済み環境変数を使用するリモートビルドで配備した。値確認用の一時ファイルは削除した。

## 合成データUAT

使用イベント:

- event ID: `5142b5f1-d9c5-4517-aea7-07bf6046705c`
- event code: `rh-c-20260715`
- event name: `[検証専用] SHIME RH-C`
- event status: `draft`

結果:

| 操作 | 結果 |
| --- | --- |
| 管理者ログイン | 200 |
| 初期一覧取得 | 200、既存snapshot 0件 |
| version 1下書き作成 | 201 |
| version 1公開 | 200 |
| version 2下書き作成 | 201 |
| version 2公開 | 200 |
| 新版公開時の旧版自動停止 | 成功 |
| 同時公開版1件制約 | 成功 |
| version 2停止 | 200 |
| 終了時の公開版 | 0件 |
| 認証済み管理画面 | 200、見出し表示確認 |
| 未認証API | 401 |

下書きには合成ラベルだけを使用し、公開プロフィールallowlistは`nickname`と`hobbies`だけに限定した。作成したversion 1、2はいずれも停止状態で履歴として残る。

## 確認できなかった項目と所見

- 受付ロール用の既存検証アカウントは現在のローカル保存パスワードで認証できず、権限不足セッションによる403実機確認は未実施。未認証401、UseCase/routeの権限テスト、staff handlerの実装確認は済んでいる。
- 存在しないevent IDで一覧APIを呼ぶと、404ではなく空一覧の200を返した。データは返らずtenant/event条件も維持されるため漏えいは確認されなかったが、存在秘匿の仕様か、`EVENT_NOT_FOUND`へ統一するかを次の独立レビューで判断する。
- 認証済み管理画面のHTTP表示は確認したが、ブラウザにstagingログイン状態がなく、320px相当の認証済み実画面操作は未実施。関連コンポーネントテスト、production build、既存モバイルE2Eは成功済み。

## 判定

会話メモ設定の作成・公開・新版切替・停止という主要ライフサイクルはstagingで成功した。featureは終了時にOFF相当（公開版0件）であり、本番イベントには影響していない。

PR #23は、GitHub Actionsの公式障害解消後に最新HEADのverify/e2eを再確認し、上記2つの所見を独立レビューで扱ってからreleaseへのマージ判断を行う。
